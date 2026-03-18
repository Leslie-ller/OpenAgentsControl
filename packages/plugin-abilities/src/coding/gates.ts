import type { NamedGateResult, ObligationResult } from '../types/index.js'

function isSatisfied(obligations: ObligationResult[], key: string): boolean {
  return obligations.some((ob) => ob.key === key && ob.status === 'satisfied')
}

function readNumberArray(payloads: Array<Record<string, unknown>>, key: string): number[] {
  const values: number[] = []
  for (const payload of payloads) {
    const value = payload[key]
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (typeof item === 'number' && Number.isFinite(item)) values.push(item)
    }
  }
  return values
}

function readStringArray(payloads: Array<Record<string, unknown>>, key: string): string[] {
  const values: string[] = []
  for (const payload of payloads) {
    const value = payload[key]
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (typeof item === 'string') values.push(item)
    }
  }
  return values
}

function readString(payloads: Array<Record<string, unknown>>, key: string): string | undefined {
  for (const payload of payloads) {
    const value = payload[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

function hasNonEmptyStringArray(payloads: Array<Record<string, unknown>>, key: string): boolean {
  for (const payload of payloads) {
    const value = payload[key]
    if (!Array.isArray(value)) continue
    if (value.some((item) => typeof item === 'string' && item.trim().length > 0)) return true
  }
  return false
}

function hasNonEmptyArray(payloads: Array<Record<string, unknown>>, key: string): boolean {
  for (const payload of payloads) {
    const value = payload[key]
    if (Array.isArray(value) && value.length > 0) return true
  }
  return false
}

export function evaluateCodeChangeGates(
  obligations: ObligationResult[],
  evidencePayloads: Array<Record<string, unknown>> = []
): NamedGateResult[] {
  const gates: NamedGateResult[] = []

  const newWorkflowActivated = isSatisfied(obligations, 'implementation_recorded')
    || isSatisfied(obligations, 'verification_evidence_recorded')
    || isSatisfied(obligations, 'review_completed')
    || isSatisfied(obligations, 'requirements_checked')
    || isSatisfied(obligations, 'affected_files_identified')

  if (!newWorkflowActivated) {
    return [
      { name: 'validation_gate', verdict: 'allow', reasons: [], warnings: [] },
      { name: 'review_gate', verdict: 'allow', reasons: [], warnings: [] },
      { name: 'scope_gate', verdict: 'allow', reasons: [], warnings: [] },
      { name: 'completion_claim_gate', verdict: 'allow', reasons: [], warnings: [] },
    ]
  }

  const validationExitCodes = readNumberArray(evidencePayloads, 'exit_codes')
  const validationResults = readStringArray(evidencePayloads, 'results').map((item) => item.toLowerCase())
  const validationEvidenceFailed = validationExitCodes.some((code) => code !== 0)
    || validationResults.some((value) => value === 'fail' || value === 'failed')

  const hasValidation = isSatisfied(obligations, 'run_tests')
    && isSatisfied(obligations, 'record_validation')
    && isSatisfied(obligations, 'verification_evidence_recorded')
    && !validationEvidenceFailed

  gates.push(
    hasValidation
      ? { name: 'validation_gate', verdict: 'allow', reasons: [], warnings: [] }
      : {
          name: 'validation_gate',
          verdict: 'block',
          reasons: [validationEvidenceFailed
            ? 'Validation evidence indicates failing verification results.'
            : 'Validation evidence is incomplete for code_change task.'],
          warnings: [],
        }
  )

  const reviewVerdict = readString(evidencePayloads, 'verdict')?.toLowerCase()
  const hasBlockingFindings = hasNonEmptyStringArray(evidencePayloads, 'blocking_findings')
  const reviewEvidenceFailed = reviewVerdict === 'fail'
    || reviewVerdict === 'failed'
    || reviewVerdict === 'changes_requested'
    || hasBlockingFindings

  const hasReview = isSatisfied(obligations, 'review_completed')
    && !reviewEvidenceFailed
  gates.push(
    hasReview
      ? { name: 'review_gate', verdict: 'allow', reasons: [], warnings: [] }
      : {
          name: 'review_gate',
          verdict: 'block',
          reasons: [reviewEvidenceFailed
            ? 'Review evidence reports blocking findings or failed verdict.'
            : 'Review artifact/evidence is missing before completion claim.'],
          warnings: [],
        }
  )

  const scopeKnown = isSatisfied(obligations, 'requirements_checked')
    && isSatisfied(obligations, 'affected_files_identified')
  gates.push(
    scopeKnown
      ? { name: 'scope_gate', verdict: 'allow', reasons: [], warnings: [] }
      : {
          name: 'scope_gate',
          verdict: 'warn',
          reasons: [],
          warnings: ['Declared scope or affected files evidence is incomplete.'],
        }
  )

  const completionReady = hasValidation && hasReview
  gates.push(
    completionReady
      ? { name: 'completion_claim_gate', verdict: 'allow', reasons: [], warnings: [] }
      : {
          name: 'completion_claim_gate',
          verdict: 'block',
          reasons: ['Cannot mark completed without validation and review evidence.'],
          warnings: [],
        }
  )

  const hasDependencyViolations = hasNonEmptyArray(evidencePayloads, 'dependency_violations')
  gates.push(
    hasDependencyViolations
      ? {
          name: 'subtask_dependency_gate',
          verdict: 'block',
          reasons: ['Subtask dependency violations detected in execution evidence.'],
          warnings: [],
        }
      : { name: 'subtask_dependency_gate', verdict: 'allow', reasons: [], warnings: [] }
  )

  return gates
}
