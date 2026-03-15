import type {
  ControlEvent,
  ObligationKey,
  ObligationSnapshot,
  ObligationState,
  TaskType,
} from './types.js'

const TEST_COMMAND_PATTERN =
  /\b(npm test|pnpm test|yarn test|bun test|vitest|jest|pytest|cargo test|go test|rspec|test)\b/i

const COMMIT_COMMAND_PATTERN =
  /\b(git commit|git\s+.*commit)\b/i

const SOURCE_COMMAND_PATTERN =
  /\b(source|citation|metadata|doi|arxiv|url)\b/i

const SUMMARY_COMMAND_PATTERN =
  /\b(summary|summarize|notes?|markdown|md)\b/i

const ROLE_COMMAND_PATTERN =
  /\b(role|classify|classification|core|survey|overview|support|mainline)\b/i

const SCREENING_DECISION_COMMAND_PATTERN =
  /\b(decision|screen|keep|drop|reject|dedupe|de-duplicate|promote|demote)\b/i

const VALUE_COMMAND_PATTERN =
  /\b(value|contribution|useful|importance|worth|benefit)\b/i

const PITFALL_COMMAND_PATTERN =
  /\b(risk|pitfall|limitation|caveat|weakness|constraint)\b/i

const USAGE_COMMAND_PATTERN =
  /\b(usage|use|recommend|position|cite|mainline|related work|roadmap)\b/i

function getStepTags(event: ControlEvent): string[] {
  const tags = event.context.stepTags ?? event.payload.stepTags
  if (!Array.isArray(tags)) {
    return []
  }

  return tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.toLowerCase())
}

function hasSignalTag(event: ControlEvent, tag: string): boolean {
  return getStepTags(event).includes(tag.toLowerCase())
}

function hasAnySignalTag(event: ControlEvent, tags: string[]): boolean {
  return tags.some((tag) => hasSignalTag(event, tag))
}

function createObligationState(key: ObligationKey, severity: ObligationState['severity'] = 'hard'): ObligationState {
  return {
    key,
    severity,
    status: 'expected',
    evidenceEventIds: [],
    notes: [],
  }
}

function updateToSatisfied(state: ObligationState, event: ControlEvent, note?: string): void {
  state.status = 'satisfied'
  state.evidenceEventIds.push(event.id)
  if (note) state.notes.push(note)
}

function updateToAttempted(state: ObligationState, event: ControlEvent, note?: string): void {
  if (state.status === 'expected') {
    state.status = 'attempted'
  }
  state.evidenceEventIds.push(event.id)
  if (note) state.notes.push(note)
}

function updateToFailed(state: ObligationState, event: ControlEvent, note?: string): void {
  state.status = 'failed'
  state.evidenceEventIds.push(event.id)
  if (note) state.notes.push(note)
}

function isTestLikeEvent(event: ControlEvent): boolean {
  if (hasSignalTag(event, 'test')) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return TEST_COMMAND_PATTERN.test(command) || /test/i.test(stepId)
}

function isCommitLikeEvent(event: ControlEvent): boolean {
  if (hasSignalTag(event, 'commit')) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return COMMIT_COMMAND_PATTERN.test(command) || /commit/i.test(stepId)
}

function isSourceLikeEvent(event: ControlEvent): boolean {
  if (hasAnySignalTag(event, ['source', 'record_source', 'record-source'])) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return SOURCE_COMMAND_PATTERN.test(command) || /(source|citation|metadata)/i.test(stepId)
}

function isSummaryLikeEvent(event: ControlEvent): boolean {
  if (hasAnySignalTag(event, ['summary', 'save_summary', 'save-summary'])) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return SUMMARY_COMMAND_PATTERN.test(command) || /(summary|notes?)/i.test(stepId)
}

function isRoleLikeEvent(event: ControlEvent): boolean {
  if (hasAnySignalTag(event, ['role', 'classify', 'classify_role', 'paper-role'])) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return ROLE_COMMAND_PATTERN.test(command) || /(role|classify)/i.test(stepId)
}

function isScreeningDecisionLikeEvent(event: ControlEvent): boolean {
  if (hasAnySignalTag(event, ['decision', 'screening_decision', 'screening-decision'])) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return SCREENING_DECISION_COMMAND_PATTERN.test(command) || /(decision|screen)/i.test(stepId)
}

function isValueLikeEvent(event: ControlEvent): boolean {
  if (hasAnySignalTag(event, ['value', 'record_value', 'paper-value'])) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return VALUE_COMMAND_PATTERN.test(command) || /(value|contribution)/i.test(stepId)
}

function isPitfallLikeEvent(event: ControlEvent): boolean {
  if (hasAnySignalTag(event, ['pitfall', 'record_pitfalls', 'limitations', 'risk'])) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return PITFALL_COMMAND_PATTERN.test(command) || /(pitfall|risk|limit)/i.test(stepId)
}

function isUsageLikeEvent(event: ControlEvent): boolean {
  if (hasAnySignalTag(event, ['usage', 'recommend_usage', 'recommend'])) {
    return true
  }

  const command = typeof event.payload.command === 'string' ? event.payload.command : ''
  const stepId = event.context.stepId ?? ''
  return USAGE_COMMAND_PATTERN.test(command) || /(usage|recommend)/i.test(stepId)
}

function isStepLifecycleEvent(event: ControlEvent): boolean {
  return (
    event.eventType === 'step.started' ||
    event.eventType === 'step.completed' ||
    event.eventType === 'step.failed'
  )
}

function applyStepObligation(
  obligations: Map<ObligationKey, ObligationState>,
  key: ObligationKey,
  event: ControlEvent,
  notePrefix: string
): void {
  const obligation = obligations.get(key)
  if (!obligation) return

  if (event.eventType === 'step.started') {
    updateToAttempted(obligation, event, `Observed ${notePrefix} step start`)
  } else if (event.eventType === 'step.completed') {
    updateToSatisfied(obligation, event, `Observed completed ${notePrefix} step`)
  } else {
    updateToFailed(obligation, event, `Observed failed ${notePrefix} step`)
  }
}

function createTaskObligations(taskType: TaskType): Map<ObligationKey, ObligationState> {
  switch (taskType) {
    case 'paper_screening':
      return new Map<ObligationKey, ObligationState>([
        ['record_source', createObligationState('record_source')],
        ['classify_paper_role', createObligationState('classify_paper_role')],
        ['record_screening_decision', createObligationState('record_screening_decision')],
      ])
    case 'paper_fulltext_review':
      return new Map<ObligationKey, ObligationState>([
        ['record_source', createObligationState('record_source')],
        ['save_summary', createObligationState('save_summary')],
        ['record_value', createObligationState('record_value')],
        ['record_pitfalls', createObligationState('record_pitfalls')],
        ['recommend_usage', createObligationState('recommend_usage')],
      ])
    case 'research_capture':
      return new Map<ObligationKey, ObligationState>([
        ['record_source', createObligationState('record_source')],
        ['save_summary', createObligationState('save_summary')],
      ])
    case 'code_change':
    default:
      return new Map<ObligationKey, ObligationState>([
        ['run_tests', createObligationState('run_tests')],
        ['record_validation', createObligationState('record_validation')],
        ['commit_if_required', createObligationState('commit_if_required', 'soft')],
      ])
  }
}

export function evaluateObligations(
  events: readonly ControlEvent[],
  taskType: TaskType = 'code_change'
): ObligationSnapshot {
  if (events.length === 0) {
    console.warn('[control] evaluateObligations received no events')
  }

  const obligations = createTaskObligations(taskType)

  const runId = events[0]?.runId ?? 'unknown-run'

  for (const event of events) {
    if (taskType === 'code_change') {
      if (
        (event.eventType === 'step.started' ||
          event.eventType === 'step.completed' ||
          event.eventType === 'step.failed') &&
        isTestLikeEvent(event)
      ) {
        const runTests = obligations.get('run_tests')
        if (!runTests) continue

        if (event.eventType === 'step.started') {
          updateToAttempted(runTests, event, 'Observed test-like step start')
        } else if (event.eventType === 'step.completed') {
          updateToSatisfied(runTests, event, 'Observed completed test-like step')
        } else {
          updateToFailed(runTests, event, 'Observed failed test-like step')
        }
      }

      if (event.eventType === 'validation.result') {
        const recordValidation = obligations.get('record_validation')
        if (!recordValidation) continue

        const passed = event.payload.passed === true
        if (passed) {
          updateToSatisfied(recordValidation, event, 'Observed successful validation result')
        } else {
          updateToFailed(recordValidation, event, 'Observed failed validation result')
        }
      }

      if (
        (event.eventType === 'step.started' ||
          event.eventType === 'step.completed' ||
          event.eventType === 'step.failed') &&
        isCommitLikeEvent(event)
      ) {
        const commitObligation = obligations.get('commit_if_required')
        if (!commitObligation) continue

        if (event.eventType === 'step.started') {
          updateToAttempted(commitObligation, event, 'Observed commit-like step start')
        } else if (event.eventType === 'step.completed') {
          updateToSatisfied(commitObligation, event, 'Observed completed commit-like step')
        } else {
          updateToFailed(commitObligation, event, 'Observed failed commit-like step')
        }
      }

      continue
    }

    if (taskType === 'research_capture') {
      if (isStepLifecycleEvent(event) && isSourceLikeEvent(event)) {
        applyStepObligation(obligations, 'record_source', event, 'source-recording')
      }

      if (isStepLifecycleEvent(event) && isSummaryLikeEvent(event)) {
        applyStepObligation(obligations, 'save_summary', event, 'summary-saving')
      }

      continue
    }

    if (taskType === 'paper_screening') {
      if (isStepLifecycleEvent(event) && isSourceLikeEvent(event)) {
        applyStepObligation(obligations, 'record_source', event, 'source-recording')
      }

      if (isStepLifecycleEvent(event) && isRoleLikeEvent(event)) {
        applyStepObligation(obligations, 'classify_paper_role', event, 'paper-role classification')
      }

      if (isStepLifecycleEvent(event) && isScreeningDecisionLikeEvent(event)) {
        applyStepObligation(obligations, 'record_screening_decision', event, 'screening-decision')
      }

      continue
    }

    if (taskType === 'paper_fulltext_review') {
      if (isStepLifecycleEvent(event) && isSourceLikeEvent(event)) {
        applyStepObligation(obligations, 'record_source', event, 'source-recording')
      }

      if (isStepLifecycleEvent(event) && isSummaryLikeEvent(event)) {
        applyStepObligation(obligations, 'save_summary', event, 'summary-saving')
      }

      if (isStepLifecycleEvent(event) && isValueLikeEvent(event)) {
        applyStepObligation(obligations, 'record_value', event, 'value-recording')
      }

      if (isStepLifecycleEvent(event) && isPitfallLikeEvent(event)) {
        applyStepObligation(obligations, 'record_pitfalls', event, 'pitfall-recording')
      }

      if (isStepLifecycleEvent(event) && isUsageLikeEvent(event)) {
        applyStepObligation(obligations, 'recommend_usage', event, 'usage-recommendation')
      }
    }
  }

  return {
    runId,
    taskType,
    obligations: Array.from(obligations.values()),
  }
}
