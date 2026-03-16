import type {
  Ability,
  ControlResult,
  GateResult,
  ObligationDefinition,
  ObligationResult,
  StepResult,
} from '../types/index.js'
import type { ControlEvent, StepCompletedPayload, ObligationSignalPayload } from './events.js'
import { evaluateModelDrift } from './model-audit.js'
import { resolveObligations, ObligationRegistry, defaultRegistry } from './obligation-registry.js'

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
  return definitions.map((definition) => {
    const matchingSteps = completedSteps.filter((step) => hasAnyTag(step, definition.tags))
    const successful = matchingSteps.filter((step) => step.status === 'completed')
    const failed = matchingSteps.filter((step) => step.status === 'failed')

    let status: ObligationResult['status'] = 'missing'
    if (successful.length > 0) {
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
      return definition.tags.includes(payload.obligation_key)
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
    if (successfulSteps.length > 0 || successfulSignals.length > 0) {
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
  const gate = evaluateGate(obligations)

  return {
    taskType: ability.task_type ?? 'custom',
    obligations,
    gate,
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
  const gate = evaluateGate(obligations)
  const modelAudit = evaluateModelDrift(events)

  return {
    taskType: ability.task_type ?? 'custom',
    obligations,
    gate,
    modelAudit,
  }
}
