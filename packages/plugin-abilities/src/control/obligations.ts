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

function createTaskObligations(taskType: TaskType): Map<ObligationKey, ObligationState> {
  switch (taskType) {
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
      if (
        (event.eventType === 'step.started' ||
          event.eventType === 'step.completed' ||
          event.eventType === 'step.failed') &&
        isSourceLikeEvent(event)
      ) {
        const recordSource = obligations.get('record_source')
        if (!recordSource) continue

        if (event.eventType === 'step.started') {
          updateToAttempted(recordSource, event, 'Observed source-recording step start')
        } else if (event.eventType === 'step.completed') {
          updateToSatisfied(recordSource, event, 'Observed completed source-recording step')
        } else {
          updateToFailed(recordSource, event, 'Observed failed source-recording step')
        }
      }

      if (
        (event.eventType === 'step.started' ||
          event.eventType === 'step.completed' ||
          event.eventType === 'step.failed') &&
        isSummaryLikeEvent(event)
      ) {
        const saveSummary = obligations.get('save_summary')
        if (!saveSummary) continue

        if (event.eventType === 'step.started') {
          updateToAttempted(saveSummary, event, 'Observed summary-saving step start')
        } else if (event.eventType === 'step.completed') {
          updateToSatisfied(saveSummary, event, 'Observed completed summary-saving step')
        } else {
          updateToFailed(saveSummary, event, 'Observed failed summary-saving step')
        }
      }
    }
  }

  return {
    runId,
    taskType,
    obligations: Array.from(obligations.values()),
  }
}
