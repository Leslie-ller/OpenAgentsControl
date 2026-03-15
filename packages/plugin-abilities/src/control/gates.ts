import type {
  CompletionGateResult,
  GateReason,
  ObligationKey,
  ObligationSnapshot,
} from './types.js'

export function evaluateCompletionGate(snapshot: ObligationSnapshot): CompletionGateResult {
  const missing: ObligationKey[] = []
  const failed: ObligationKey[] = []
  const warnings: ObligationKey[] = []
  const reasons: GateReason[] = []

  for (const obligation of snapshot.obligations) {
    const unsatisfied =
      obligation.status === 'missing' ||
      obligation.status === 'expected' ||
      obligation.status === 'attempted'

    if (obligation.severity === 'hard') {
      if (unsatisfied) {
        missing.push(obligation.key)
        reasons.push({
          code: 'MISSING_HARD_OBLIGATION',
          message: `${obligation.key} is not satisfied (${obligation.status})`,
        })
      } else if (obligation.status === 'failed') {
        failed.push(obligation.key)
        reasons.push({
          code: 'FAILED_HARD_OBLIGATION',
          message: `${obligation.key} failed`,
        })
      }
      continue
    }

    if (unsatisfied) {
      warnings.push(obligation.key)
      reasons.push({
        code: 'MISSING_SOFT_OBLIGATION',
        message: `${obligation.key} is not satisfied (${obligation.status})`,
      })
    } else if (obligation.status === 'failed') {
      warnings.push(obligation.key)
      reasons.push({
        code: 'FAILED_SOFT_OBLIGATION',
        message: `${obligation.key} failed`,
      })
    }
  }

  if (missing.length > 0 || failed.length > 0) {
    return {
      runId: snapshot.runId,
      verdict: 'block',
      reasons,
      missing,
      failed,
      warnings,
    }
  }

  if (warnings.length > 0) {
    return {
      runId: snapshot.runId,
      verdict: 'warn',
      reasons,
      missing: [],
      failed: [],
      warnings,
    }
  }

  return {
    runId: snapshot.runId,
    verdict: 'allow',
    reasons: [
      {
        code: 'ALL_HARD_OBLIGATIONS_SATISFIED',
        message: 'All hard obligations satisfied',
      },
    ],
    missing: [],
    failed: [],
    warnings: [],
  }
}
