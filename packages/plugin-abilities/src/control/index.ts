import type {
  Ability,
  ControlResult,
  GateResult,
  ObligationKey,
  ObligationResult,
  ObligationSeverity,
  StepResult,
  TaskType,
} from '../types/index.js'

interface ObligationDefinition {
  key: ObligationKey
  severity: ObligationSeverity
  tags: string[]
}

const TASK_OBLIGATIONS: Partial<Record<TaskType, ObligationDefinition[]>> = {
  code_change: [
    { key: 'run_tests', severity: 'hard', tags: ['test'] },
    { key: 'record_validation', severity: 'hard', tags: ['validation'] },
    { key: 'commit_if_required', severity: 'soft', tags: ['commit'] },
  ],
  paper_screening: [
    { key: 'record_screening_decision', severity: 'hard', tags: ['screening-decision'] },
  ],
  paper_fulltext_review: [
    { key: 'extract_fulltext', severity: 'hard', tags: ['fulltext-extract'] },
    { key: 'record_reading_card', severity: 'hard', tags: ['reading-card'] },
  ],
  literature_decision: [
    { key: 'record_decision_card', severity: 'hard', tags: ['decision-card'] },
  ],
  section_evidence_pack: [
    { key: 'record_evidence_pack', severity: 'hard', tags: ['evidence-pack'] },
  ],
  citation_audit: [
    { key: 'record_citation_audit', severity: 'hard', tags: ['citation-audit'] },
  ],
}

function hasAnyTag(result: StepResult, tags: string[]): boolean {
  const stepTags = result.tags || []
  return tags.some((tag) => stepTags.includes(tag))
}

function evaluateObligations(taskType: TaskType, completedSteps: StepResult[]): ObligationResult[] {
  const definitions = TASK_OBLIGATIONS[taskType] || []

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

export function evaluateControl(ability: Ability, completedSteps: StepResult[]): ControlResult | undefined {
  if (!ability.task_type) {
    return undefined
  }

  const obligations = evaluateObligations(ability.task_type, completedSteps)
  const gate = evaluateGate(obligations)

  return {
    taskType: ability.task_type,
    obligations,
    gate,
  }
}
