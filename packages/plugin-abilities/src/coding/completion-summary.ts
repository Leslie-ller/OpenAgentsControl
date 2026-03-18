import type {
  AbilityExecution,
  GateVerdict,
  ObligationResult,
} from '../types/index.js'
import type { CompletionSummaryData } from './artifact-store.js'

function obligationSatisfied(obligations: ObligationResult[], key: string): boolean {
  return obligations.some((item) => item.key === key && item.status === 'satisfied')
}

function parseStructuredStepOutputs(execution: AbilityExecution): Array<Record<string, unknown>> {
  return execution.completedSteps
    .map((step) => step.output)
    .filter((output): output is string => typeof output === 'string' && output.trim().length > 0)
    .map((output) => {
      try {
        const parsed = JSON.parse(output.trim())
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // ignore non-JSON outputs
      }
      return undefined
    })
    .filter((item): item is Record<string, unknown> => item !== undefined)
}

function readStringArray(payloads: Array<Record<string, unknown>>, key: string): string[] {
  const values: string[] = []
  for (const payload of payloads) {
    const value = payload[key]
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (typeof item === 'string' && item.trim().length > 0) values.push(item.trim())
    }
  }
  return values
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function deriveStatus(
  executionStatus: AbilityExecution['status'],
  gateVerdict: GateVerdict | undefined,
  validated: boolean,
  reviewed: boolean
): CompletionSummaryData['status'] {
  if (executionStatus === 'failed' || gateVerdict === 'block') return 'blocked'
  if (gateVerdict === 'warn' || !validated || !reviewed) return 'partial'
  return 'completed'
}

export function deriveCompletionSummary(execution: AbilityExecution): CompletionSummaryData | null {
  if (execution.ability.task_type !== 'code_change') return null

  const obligations = execution.control?.obligations ?? []
  const gate = execution.control?.gate
  const gateVerdict = gate?.verdict
  const evidence = parseStructuredStepOutputs(execution)

  const validated = obligationSatisfied(obligations, 'run_tests')
    && obligationSatisfied(obligations, 'record_validation')
    && obligationSatisfied(obligations, 'verification_evidence_recorded')
  const reviewed = obligationSatisfied(obligations, 'review_completed')

  const status = deriveStatus(execution.status, gateVerdict, validated, reviewed)

  const obligationRisks = obligations
    .filter((item) => item.status !== 'satisfied')
    .map((item) => `${item.severity} obligation ${item.key} is ${item.status}`)
  const gateRisks = [...(gate?.reasons ?? []), ...(gate?.warnings ?? [])]
  const artifactRisks = readStringArray(evidence, 'remaining_risks')
  const remaining_risks = unique([...obligationRisks, ...gateRisks, ...artifactRisks])

  const artifactActions = readStringArray(evidence, 'next_actions')
  const defaultNextActions: string[] = []
  if (status === 'blocked') {
    defaultNextActions.push('Resolve blocking validation/review issues before claiming completion.')
  } else if (status === 'partial') {
    defaultNextActions.push('Address remaining warnings and missing evidence before marking done.')
  }

  return {
    task_id: String(execution.inputs.task_id ?? execution.id),
    status,
    validated,
    reviewed,
    remaining_risks,
    next_actions: unique([...artifactActions, ...defaultNextActions]),
  }
}
