import type { NamedGateResult, ObligationResult } from '../types/index.js'

function isSatisfied(obligations: ObligationResult[], key: string): boolean {
  return obligations.some((ob) => ob.key === key && ob.status === 'satisfied')
}

export function evaluateCodeChangeGates(obligations: ObligationResult[]): NamedGateResult[] {
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

  const hasValidation = isSatisfied(obligations, 'run_tests')
    && isSatisfied(obligations, 'record_validation')
    && isSatisfied(obligations, 'verification_evidence_recorded')

  gates.push(
    hasValidation
      ? { name: 'validation_gate', verdict: 'allow', reasons: [], warnings: [] }
      : {
          name: 'validation_gate',
          verdict: 'block',
          reasons: ['Validation evidence is incomplete for code_change task.'],
          warnings: [],
        }
  )

  const hasReview = isSatisfied(obligations, 'review_completed')
  gates.push(
    hasReview
      ? { name: 'review_gate', verdict: 'allow', reasons: [], warnings: [] }
      : {
          name: 'review_gate',
          verdict: 'block',
          reasons: ['Review artifact/evidence is missing before completion claim.'],
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

  return gates
}
