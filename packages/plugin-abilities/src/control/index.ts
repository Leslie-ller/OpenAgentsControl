import type {
  Ability,
  ControlResult,
  GateResult,
  NamedGateResult,
  ObligationDefinition,
  ObligationResult,
  StepResult,
} from '../types/index.js'
import type { ControlEvent, StepCompletedPayload, ObligationSignalPayload } from './events.js'
import { evaluateModelDrift } from './model-audit.js'
import { resolveObligations, ObligationRegistry, defaultRegistry } from './obligation-registry.js'
import { evaluateCodeChangeGates } from '../coding/gates.js'

// ─────────────────────────────────────────────────────────────
// STEP-BASED EVALUATION (original path, backward compatible)
// ─────────────────────────────────────────────────────────────

function hasAnyTag(result: StepResult, tags: string[]): boolean {
  const stepTags = result.tags || []
  return tags.some((tag) => stepTags.includes(tag))
}

function evaluateObligationsFromDefinitions(
  definitions: ObligationDefinition[],
  completedSteps: StepResult[]
): ObligationResult[] {
  const structuredEvidence = extractStructuredEvidenceFromSteps(completedSteps)

  return definitions.map((definition) => {
    const matchingSteps = completedSteps.filter((step) => hasAnyTag(step, definition.tags))
    const successful = matchingSteps.filter((step) => step.status === 'completed')
    const failed = matchingSteps.filter((step) => step.status === 'failed')

    const hasRequiredFields = !definition.requiredFields || definition.requiredFields.length === 0
      ? true
      : hasEvidenceWithRequiredFields(structuredEvidence, definition.requiredFields)

    const hasMinimumEvidence = definition.minEvidenceCount === undefined
      ? true
      : structuredEvidence.some((item) => {
          const count = numericField(item, 'anchors_count')
          return count !== undefined && count >= definition.minEvidenceCount!
        })

    let status: ObligationResult['status'] = 'missing'
    if (successful.length > 0 && hasRequiredFields && hasMinimumEvidence) {
      status = 'satisfied'
    } else if (failed.length > 0) {
      status = 'failed'
    }

    return {
      key: definition.key,
      severity: definition.severity,
      status,
      evidenceStepIds: matchingSteps.map((step) => step.stepId),
    }
  })
}

// ─────────────────────────────────────────────────────────────
// EVENT-BASED EVALUATION (new path, consumes event stream)
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate obligations from the unified event stream.
 * Instead of directly reading step tags, this reconstructs
 * obligation satisfaction from step.completed and obligation.signal events.
 */
function evaluateObligationsFromEvents(
  definitions: ObligationDefinition[],
  events: readonly ControlEvent[]
): ObligationResult[] {
  // Collect evidence from step completion events
  const stepCompletedEvents = events.filter(
    (e) => e.event_type === 'step.completed' || e.event_type === 'step.failed'
  )
  const obligationSignalEvents = events.filter(
    (e) => e.event_type === 'obligation.signal'
  )
  const evidenceStatsEvents = events.filter(
    (e) => e.event_type === 'evidence.stats'
  )

  return definitions.map((definition) => {
    // Check step completion events for matching tags
    const matchingStepEvents = stepCompletedEvents.filter((e) => {
      const payload = e.payload as StepCompletedPayload
      const tags = payload.tags || []
      return definition.tags.some((tag) => tags.includes(tag))
    })

    // Check obligation signal events for matching tags
    const matchingSignalEvents = obligationSignalEvents.filter((e) => {
      const payload = e.payload as ObligationSignalPayload
      const acceptedKeys = new Set<string>([
        ...definition.tags,
        ...(definition.signals ?? []),
      ])
      return acceptedKeys.has(payload.obligation_key)
    })

    const hasRequiredFields = !definition.requiredFields || definition.requiredFields.length === 0
      ? true
      : evidenceStatsEvents.some((e) => {
          const payload = e.payload as Record<string, unknown>
          return definition.requiredFields!.every((field) => payload[field] !== undefined)
        })

    const hasMinimumEvidence = definition.minEvidenceCount === undefined
      ? true
      : evidenceStatsEvents.some((e) => {
          const payload = e.payload as Record<string, unknown>
          const count = numericField(payload, 'anchors_count')
          return count !== undefined && count >= definition.minEvidenceCount!
        })

    // Determine satisfaction status
    const successfulSteps = matchingStepEvents.filter((e) => {
      const payload = e.payload as StepCompletedPayload
      return payload.status === 'completed'
    })
    const failedSteps = matchingStepEvents.filter((e) => {
      const payload = e.payload as StepCompletedPayload
      return payload.status === 'failed'
    })
    const successfulSignals = matchingSignalEvents.filter((e) => {
      const payload = e.payload as ObligationSignalPayload
      const evidence = payload.evidence as Record<string, unknown>
      return evidence.status === 'completed'
    })

    // Build evidence step IDs from both sources
    const evidenceStepIds: string[] = [
      ...matchingStepEvents.map((e) => (e.payload as StepCompletedPayload).step_id),
      ...matchingSignalEvents.map((e) => (e.payload as ObligationSignalPayload).evidence?.step_id as string).filter(Boolean),
    ]

    let status: ObligationResult['status'] = 'missing'
    if ((successfulSteps.length > 0 || successfulSignals.length > 0) && hasRequiredFields && hasMinimumEvidence) {
      status = 'satisfied'
    } else if (failedSteps.length > 0) {
      status = 'failed'
    }

    return {
      key: definition.key,
      severity: definition.severity,
      status,
      evidenceStepIds,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// GATE EVALUATION (shared by both paths)
// ─────────────────────────────────────────────────────────────

function evaluateGate(obligations: ObligationResult[]): GateResult {
  const failedHard = obligations.filter((item) => item.severity === 'hard' && item.status === 'failed')
  const missingHard = obligations.filter((item) => item.severity === 'hard' && item.status === 'missing')
  const softIssues = obligations.filter((item) => item.severity === 'soft' && item.status !== 'satisfied')

  if (failedHard.length > 0 || missingHard.length > 0) {
    const reasons = [
      ...failedHard.map((item) => `Failed hard obligation: ${item.key}`),
      ...missingHard.map((item) => `Missing hard obligation: ${item.key}`),
    ]
    return {
      verdict: 'block',
      reasons,
      warnings: softIssues.map((item) => `${item.status === 'failed' ? 'Failed' : 'Missing'} soft obligation: ${item.key}`),
    }
  }

  if (softIssues.length > 0) {
    return {
      verdict: 'warn',
      reasons: [],
      warnings: softIssues.map((item) => `${item.status === 'failed' ? 'Failed' : 'Missing'} soft obligation: ${item.key}`),
    }
  }

  return {
    verdict: 'allow',
    reasons: [],
    warnings: [],
  }
}

function evaluateNamedGates(
  obligations: ObligationResult[],
  events: readonly ControlEvent[]
): NamedGateResult[] {
  const gates: NamedGateResult[] = []
  const defaultGate = evaluateGate(obligations)
  gates.push({ name: 'default_gate', ...defaultGate })

  const evidenceStatsEvents = events
    .filter((e) => e.event_type === 'evidence.stats')
    .map((e) => e.payload as Record<string, unknown>)

  const sufficiencyValues = evidenceStatsEvents
    .map((payload) => numericField(payload, 'sufficiency_score'))
    .filter((value): value is number => value !== undefined)

  if (sufficiencyValues.length > 0) {
    const lowScore = sufficiencyValues.some((score) => score < 0.6)
    const midScore = sufficiencyValues.some((score) => score >= 0.6 && score < 0.75)
    if (lowScore) {
      gates.push({
        name: 'sufficiency_gate',
        verdict: 'block',
        reasons: ['Task-level sufficiency score below 0.6'],
        warnings: [],
      })
    } else if (midScore) {
      gates.push({
        name: 'sufficiency_gate',
        verdict: 'warn',
        reasons: [],
        warnings: ['Task-level sufficiency score is partial (0.6-0.75)'],
      })
    } else {
      gates.push({
        name: 'sufficiency_gate',
        verdict: 'allow',
        reasons: [],
        warnings: [],
      })
    }
  }

  const consistencyFlags = evidenceStatsEvents
    .map((payload) => booleanField(payload, 'consistency_ok'))
    .filter((value): value is boolean => value !== undefined)
  if (consistencyFlags.length > 0) {
    if (consistencyFlags.includes(false)) {
      gates.push({
        name: 'consistency_gate',
        verdict: 'block',
        reasons: ['Consistency check failed (role/usage/limitations mismatch)'],
        warnings: [],
      })
    } else {
      gates.push({ name: 'consistency_gate', verdict: 'allow', reasons: [], warnings: [] })
    }
  }

  const capabilityFlags = evidenceStatsEvents
    .map((payload) => booleanField(payload, 'capability_ok'))
    .filter((value): value is boolean => value !== undefined)
  if (capabilityFlags.length > 0) {
    if (capabilityFlags.includes(false)) {
      gates.push({
        name: 'capability_gate',
        verdict: 'block',
        reasons: ['Required capability/toolchain is unavailable'],
        warnings: [],
      })
    } else {
      gates.push({ name: 'capability_gate', verdict: 'allow', reasons: [], warnings: [] })
    }
  }

  const claimScopeFlags = evidenceStatsEvents
    .map((payload) => booleanField(payload, 'claim_scope_ok'))
    .filter((value): value is boolean => value !== undefined)
  if (claimScopeFlags.length > 0) {
    if (claimScopeFlags.includes(false)) {
      gates.push({
        name: 'claim_scope_gate',
        verdict: 'block',
        reasons: ['Claim scope exceeded available evidence support'],
        warnings: [],
      })
    } else {
      gates.push({ name: 'claim_scope_gate', verdict: 'allow', reasons: [], warnings: [] })
    }
  }

  const groundingRatios = evidenceStatsEvents
    .map((payload) => {
      const grounded = numericField(payload, 'grounded_claims')
      const total = numericField(payload, 'total_claims')
      if (grounded === undefined || total === undefined || total <= 0) return undefined
      return grounded / total
    })
    .filter((value): value is number => value !== undefined)

  if (groundingRatios.length > 0) {
    const lowGrounding = groundingRatios.some((ratio) => ratio < 0.6)
    const partialGrounding = groundingRatios.some((ratio) => ratio >= 0.6 && ratio < 1)
    if (lowGrounding) {
      gates.push({
        name: 'grounding_completeness_gate',
        verdict: 'block',
        reasons: ['Grounding completeness below threshold (60%)'],
        warnings: [],
      })
    } else if (partialGrounding) {
      gates.push({
        name: 'grounding_completeness_gate',
        verdict: 'warn',
        reasons: [],
        warnings: ['Grounding completeness is partial (<100%)'],
      })
    } else {
      gates.push({ name: 'grounding_completeness_gate', verdict: 'allow', reasons: [], warnings: [] })
    }
  }

  return gates
}

function mergeGates(gates: NamedGateResult[]): GateResult {
  const formatReason = (gate: NamedGateResult, reason: string) => {
    return gate.name === 'default_gate' ? reason : `[${gate.name}] ${reason}`
  }
  const formatWarning = (gate: NamedGateResult, warning: string) => {
    return gate.name === 'default_gate' ? warning : `[${gate.name}] ${warning}`
  }

  const blocked = gates.filter((gate) => gate.verdict === 'block')
  if (blocked.length > 0) {
    return {
      verdict: 'block',
      reasons: blocked.flatMap((gate) => gate.reasons.map((reason) => formatReason(gate, reason))),
      warnings: gates.flatMap((gate) => gate.warnings.map((warning) => formatWarning(gate, warning))),
    }
  }

  const warned = gates.filter((gate) => gate.verdict === 'warn')
  if (warned.length > 0) {
    return {
      verdict: 'warn',
      reasons: [],
      warnings: warned.flatMap((gate) => gate.warnings.map((warning) => formatWarning(gate, warning))),
    }
  }

  return { verdict: 'allow', reasons: [], warnings: [] }
}

function appendCodeChangeGates(ability: Ability, obligations: ObligationResult[], existing: NamedGateResult[]): NamedGateResult[] {
  if (ability.task_type !== 'code_change') return existing
  return [...existing, ...evaluateCodeChangeGates(obligations)]
}

function extractStructuredEvidenceFromSteps(completedSteps: StepResult[]): Array<Record<string, unknown>> {
  return completedSteps
    .map((step) => step.output)
    .filter((output): output is string => typeof output === 'string' && output.trim().length > 0)
    .map((output) => {
      try {
        const parsed = JSON.parse(output.trim())
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // ignore non-JSON output
      }
      return undefined
    })
    .filter((item): item is Record<string, unknown> => item !== undefined)
}

function hasEvidenceWithRequiredFields(
  evidence: Array<Record<string, unknown>>,
  fields: string[]
): boolean {
  if (fields.length === 0) return true
  return evidence.some((item) => fields.every((field) => item[field] !== undefined))
}

function numericField(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanField(payload: Record<string, unknown>, key: string): boolean | undefined {
  const value = payload[key]
  return typeof value === 'boolean' ? value : undefined
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Step-based control evaluation.
 * Uses the ObligationRegistry to resolve obligation definitions.
 * Backward compatible: existing abilities with built-in task types
 * continue to work exactly as before.
 */
export function evaluateControl(ability: Ability, completedSteps: StepResult[]): ControlResult | undefined {
  if (!ability.task_type && !ability.obligations) {
    return undefined
  }

  const definitions = resolveObligations(ability)
  if (definitions.length === 0 && !ability.task_type) {
    return undefined
  }

  const obligations = evaluateObligationsFromDefinitions(definitions, completedSteps)
  const baseGate = evaluateGate(obligations)
  const gates = appendCodeChangeGates(
    ability,
    obligations,
    [{ name: 'default_gate', ...baseGate }]
  )
  const gate = mergeGates(gates)

  return {
    taskType: ability.task_type ?? 'custom',
    obligations,
    gate,
    gates,
  }
}

/**
 * Event-based control evaluation.
 * Uses the ObligationRegistry to resolve obligation definitions.
 * Also evaluates model drift audit from model.observed events.
 * This is the preferred path when a ControlEventBus is available.
 */
export function evaluateControlFromEvents(
  ability: Ability,
  events: readonly ControlEvent[]
): ControlResult | undefined {
  if (!ability.task_type && !ability.obligations) {
    return undefined
  }

  const definitions = resolveObligations(ability)
  if (definitions.length === 0 && !ability.task_type) {
    return undefined
  }

  const obligations = evaluateObligationsFromEvents(definitions, events)
  const gates = appendCodeChangeGates(ability, obligations, evaluateNamedGates(obligations, events))
  const gate = mergeGates(gates)
  const modelAudit = evaluateModelDrift(events)

  return {
    taskType: ability.task_type ?? 'custom',
    obligations,
    gate,
    gates,
    modelAudit,
  }
}
