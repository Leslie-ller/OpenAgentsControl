import { describe, expect, test } from 'bun:test'
import { executeAbility } from '../src/executor/index.js'
import { collectExecutionEvents, evaluateCompletionGate, evaluateModelDrift, evaluateObligations, MidRunGateMonitor } from '../src/control/index.js'
import { ControlEventBus } from '../src/control/event-bus.js'
import { createEventCallbacks } from '../src/control/event-adapter.js'
import type { ObligationSnapshot } from '../src/control/index.js'
import type { Ability, ExecutorContext } from '../src/types/index.js'

const ctx: ExecutorContext = {
  cwd: '/tmp',
  env: {},
}

describe('control layer v1', () => {
  test('blocks completion when no tests were run', async () => {
    const ability: Ability = {
      name: 'no-tests',
      description: 'Changes code but does not run tests',
      steps: [
        { id: 'implement', type: 'script', run: 'echo "changed code"' },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const gate = evaluateCompletionGate(obligations)

    expect(execution.status).toBe('completed')
    expect(gate.verdict).toBe('block')
    expect(gate.missing).toContain('run_tests')
    expect(gate.missing).toContain('record_validation')
    expect(gate.warnings).toContain('commit_if_required')
  })

  test('blocks completion when tests ran without validation evidence', async () => {
    const ability: Ability = {
      name: 'tests-no-validation',
      description: 'Runs test-like step but no validation config',
      steps: [
        { id: 'run-tests', type: 'script', run: 'exit 0' },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const gate = evaluateCompletionGate(obligations)

    expect(gate.verdict).toBe('block')
    expect(gate.missing).toEqual(['record_validation'])
    expect(gate.failed).toEqual([])
    expect(gate.warnings).toContain('commit_if_required')
  })

  test('preserves attempted-compatible audit detail instead of collapsing all unsatisfied states', async () => {
    const ability: Ability = {
      name: 'attempted-tests',
      description: 'Starts a test-like step but provides no validation evidence',
      steps: [
        { id: 'run-tests', type: 'script', run: 'echo "running tests"' },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const runTests = obligations.obligations.find((o) => o.key === 'run_tests')
    const recordValidation = obligations.obligations.find((o) => o.key === 'record_validation')
    const gate = evaluateCompletionGate(obligations)

    expect(runTests?.status).toBe('satisfied')
    expect(recordValidation?.status).toBe('expected')
    expect(gate.verdict).toBe('block')
    expect(gate.missing).toContain('record_validation')
    expect(gate.warnings).toContain('commit_if_required')
  })

  test('warns when hard obligations pass but no commit step exists', async () => {
    const ability: Ability = {
      name: 'tests-with-validation',
      description: 'Runs tests with exit code validation',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'exit 0',
          validation: { exit_code: 0 },
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const gate = evaluateCompletionGate(obligations)

    expect(gate.verdict).toBe('warn')
    expect(gate.missing).toEqual([])
    expect(gate.failed).toEqual([])
    expect(gate.warnings).toContain('commit_if_required')
  })

  test('documents heuristic blind spot when test work does not look like a test', async () => {
    const ability: Ability = {
      name: 'heuristic-blind-spot',
      description: 'Current heuristic misses this test-like command',
      steps: [
        {
          id: 'execute-suite',
          type: 'script',
          run: 'echo "suite executed"',
          validation: { exit_code: 0 },
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const gate = evaluateCompletionGate(obligations)

    expect(execution.status).toBe('completed')
    expect(gate.verdict).toBe('block')
    expect(gate.missing).toContain('run_tests')
    expect(gate.warnings).toContain('commit_if_required')
  })

  test('documents false positive risk when non-test step name contains test', async () => {
    const ability: Ability = {
      name: 'heuristic-false-positive',
      description: 'Current heuristic may misclassify this as tests',
      steps: [
        {
          id: 'generate-test-fixtures',
          type: 'script',
          run: 'echo "fixtures"',
          validation: { exit_code: 0 },
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const runTests = obligations.obligations.find((o) => o.key === 'run_tests')
    const gate = evaluateCompletionGate(obligations)

    expect(runTests?.status).toBe('satisfied')
    expect(gate.verdict).toBe('warn')
    expect(gate.warnings).toContain('commit_if_required')
  })

  test('uses explicit test tag even when command and step id are not test-like', async () => {
    const ability: Ability = {
      name: 'tagged-test-step',
      description: 'Uses explicit test signaling',
      steps: [
        {
          id: 'execute-suite',
          type: 'script',
          run: 'echo "suite executed"',
          tags: ['test'],
          validation: { exit_code: 0 },
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const runTests = obligations.obligations.find((o) => o.key === 'run_tests')
    const gate = evaluateCompletionGate(obligations)

    expect(runTests?.status).toBe('satisfied')
    expect(gate.verdict).toBe('warn')
    expect(gate.missing).toEqual([])
    expect(gate.warnings).toContain('commit_if_required')
  })

  test('uses explicit commit tag even when command and step id are not commit-like', async () => {
    const ability: Ability = {
      name: 'tagged-commit-step',
      description: 'Uses explicit commit signaling',
      steps: [
        {
          id: 'persist-results',
          type: 'script',
          run: 'echo "saved metadata"',
          tags: ['commit'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const commitObligation = obligations.obligations.find((o) => o.key === 'commit_if_required')

    expect(commitObligation?.status).toBe('satisfied')
  })

  test('warns when only soft obligations are unsatisfied', () => {
    const snapshot: ObligationSnapshot = {
      runId: 'run_soft_warn',
      taskType: 'code_change',
      obligations: [
        {
          key: 'run_tests',
          severity: 'hard',
          status: 'satisfied',
          evidenceEventIds: ['evt1'],
          notes: [],
        },
        {
          key: 'record_validation',
          severity: 'soft',
          status: 'expected',
          evidenceEventIds: [],
          notes: [],
        },
      ],
    }

    const gate = evaluateCompletionGate(snapshot)

    expect(gate.verdict).toBe('warn')
    expect(gate.missing).toEqual([])
    expect(gate.failed).toEqual([])
    expect(gate.warnings).toEqual(['record_validation'])
  })

  test('still blocks when hard obligations fail even if soft obligations also warn', () => {
    const snapshot: ObligationSnapshot = {
      runId: 'run_hard_block_soft_warn',
      taskType: 'code_change',
      obligations: [
        {
          key: 'run_tests',
          severity: 'hard',
          status: 'failed',
          evidenceEventIds: ['evt1'],
          notes: [],
        },
        {
          key: 'record_validation',
          severity: 'soft',
          status: 'attempted',
          evidenceEventIds: ['evt2'],
          notes: [],
        },
      ],
    }

    const gate = evaluateCompletionGate(snapshot)

    expect(gate.verdict).toBe('block')
    expect(gate.failed).toEqual(['run_tests'])
    expect(gate.warnings).toEqual(['record_validation'])
  })

  test('allows completion when all obligations including commit are satisfied', async () => {
    const ability: Ability = {
      name: 'full-workflow',
      description: 'Tests, validates, and commits',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'bun test',
          validation: { exit_code: 0 },
        },
        {
          id: 'commit-changes',
          type: 'script',
          run: 'git commit -m "fix: resolved issue"',
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const gate = evaluateCompletionGate(obligations)

    const commitObligation = obligations.obligations.find((o) => o.key === 'commit_if_required')
    expect(commitObligation?.status).toBe('satisfied')
    expect(commitObligation?.severity).toBe('soft')
    expect(gate.verdict).toBe('allow')
    expect(gate.missing).toEqual([])
    expect(gate.failed).toEqual([])
    expect(gate.warnings).toEqual([])
  })

  test('commit_if_required is soft and detected by command heuristic', async () => {
    const ability: Ability = {
      name: 'commit-only',
      description: 'Only does a commit',
      steps: [
        {
          id: 'do-commit',
          type: 'script',
          run: 'git commit -am "chore: update"',
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const commitObligation = obligations.obligations.find((o) => o.key === 'commit_if_required')

    expect(commitObligation?.severity).toBe('soft')
    expect(commitObligation?.status).toBe('satisfied')
    expect(commitObligation?.evidenceEventIds.length).toBeGreaterThan(0)
  })

  test('commit_if_required detected by stepId heuristic', async () => {
    const ability: Ability = {
      name: 'commit-by-id',
      description: 'Step ID contains commit',
      steps: [
        {
          id: 'git-commit-result',
          type: 'script',
          run: 'echo "committed"',
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'code_change')
    const obligations = evaluateObligations(events, 'code_change')
    const commitObligation = obligations.obligations.find((o) => o.key === 'commit_if_required')

    expect(commitObligation?.status).toBe('satisfied')
  })

  test('research_capture blocks when source and summary evidence are both missing', async () => {
    const ability: Ability = {
      name: 'research-missing-evidence',
      description: 'Collects a paper without recording source or summary',
      task_type: 'research_capture',
      steps: [
        {
          id: 'collect-paper',
          type: 'script',
          run: 'echo "paper collected"',
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'research_capture')
    const obligations = evaluateObligations(events, 'research_capture')
    const gate = evaluateCompletionGate(obligations)

    expect(gate.verdict).toBe('block')
    expect(gate.missing).toEqual(['record_source', 'save_summary'])
    expect(gate.warnings).toEqual([])
  })

  test('research_capture allows completion when source and summary obligations are satisfied', async () => {
    const ability: Ability = {
      name: 'research-pass',
      description: 'Records source and saves summary',
      task_type: 'research_capture',
      steps: [
        {
          id: 'record-paper-source',
          type: 'script',
          run: 'echo "doi:10.1000/test"',
          tags: ['source'],
        },
        {
          id: 'save-paper-summary',
          type: 'script',
          run: 'echo "summary saved"',
          tags: ['summary'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'research_capture')
    const obligations = evaluateObligations(events, 'research_capture')
    const gate = evaluateCompletionGate(obligations)

    const recordSource = obligations.obligations.find((o) => o.key === 'record_source')
    const saveSummary = obligations.obligations.find((o) => o.key === 'save_summary')

    expect(recordSource?.status).toBe('satisfied')
    expect(saveSummary?.status).toBe('satisfied')
    expect(gate.verdict).toBe('allow')
    expect(gate.missing).toEqual([])
    expect(gate.failed).toEqual([])
    expect(gate.warnings).toEqual([])
  })

  test('paper_screening allows completion when source, role, and decision are recorded', async () => {
    const ability: Ability = {
      name: 'paper-screening-pass',
      description: 'Classifies a candidate paper and records a decision',
      task_type: 'paper_screening',
      steps: [
        {
          id: 'record-paper-source',
          type: 'script',
          run: 'echo "doi:10.1000/test"',
          tags: ['source'],
        },
        {
          id: 'classify-paper-role',
          type: 'script',
          run: 'echo "core support"',
          tags: ['role'],
        },
        {
          id: 'record-screening-decision',
          type: 'script',
          run: 'echo "keep for fulltext review"',
          tags: ['decision'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'paper_screening')
    const obligations = evaluateObligations(events, 'paper_screening')
    const gate = evaluateCompletionGate(obligations)

    expect(gate.verdict).toBe('allow')
    expect(gate.missing).toEqual([])
  })

  test('paper_fulltext_review blocks when value, pitfalls, and usage are missing', async () => {
    const ability: Ability = {
      name: 'paper-fulltext-review-missing',
      description: 'Reads paper but leaves review structure incomplete',
      task_type: 'paper_fulltext_review',
      steps: [
        {
          id: 'record-paper-source',
          type: 'script',
          run: 'echo "doi:10.1000/test"',
          tags: ['source'],
        },
        {
          id: 'save-paper-summary',
          type: 'script',
          run: 'echo "summary saved"',
          tags: ['summary'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, ctx)
    const events = collectExecutionEvents(execution, 'paper_fulltext_review')
    const obligations = evaluateObligations(events, 'paper_fulltext_review')
    const gate = evaluateCompletionGate(obligations)

    expect(gate.verdict).toBe('block')
    expect(gate.missing).toEqual(['record_value', 'record_pitfalls', 'recommend_usage'])
  })
})

// ─────────────────────────────────────────────────────────────
// Real-time event bus + adapter tests
// ─────────────────────────────────────────────────────────────

describe('real-time event bus', () => {
  test('emits events and accumulates an ordered log', () => {
    const bus = new ControlEventBus('run_rt_1', 'code_change')
    const received: any[] = []
    bus.on((evt) => received.push(evt))

    bus.emit(
      'run.started',
      { kind: 'system', id: 'test' },
      { ability: 'demo' },
      { foo: 1 }
    )
    bus.emit(
      'step.started',
      { kind: 'system', id: 'test' },
      { ability: 'demo', stepId: 's1' },
      { stepId: 's1' }
    )

    expect(received).toHaveLength(2)
    expect(bus.getLog()).toHaveLength(2)
    expect(bus.getLog()[0].eventType).toBe('run.started')
    expect(bus.getLog()[1].eventType).toBe('step.started')
    expect(bus.getRunId()).toBe('run_rt_1')
    expect(bus.getTaskType()).toBe('code_change')
  })

  test('handler errors do not prevent subsequent handlers', () => {
    const bus = new ControlEventBus('run_rt_2', 'code_change')
    const results: string[] = []

    bus.on(() => { throw new Error('boom') })
    bus.on(() => results.push('ok'))

    bus.emit(
      'run.started',
      { kind: 'system', id: 'test' },
      { ability: 'demo' },
      {}
    )

    expect(results).toEqual(['ok'])
    expect(bus.getLog()).toHaveLength(1)
  })

  test('unsubscribe removes handler', () => {
    const bus = new ControlEventBus('run_rt_3', 'code_change')
    const results: string[] = []

    const unsub = bus.on(() => results.push('called'))
    bus.emit('run.started', { kind: 'system', id: 'test' }, { ability: 'a' }, {})
    expect(results).toHaveLength(1)

    unsub()
    bus.emit('run.completed', { kind: 'system', id: 'test' }, { ability: 'a' }, {})
    expect(results).toHaveLength(1) // not called again
  })
})

describe('real-time event adapter', () => {
  test('real-time bus produces same gate result as post-hoc replay (warn)', async () => {
    const ability: Ability = {
      name: 'tests-with-validation',
      description: 'Runs tests with exit code validation',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'exit 0',
          validation: { exit_code: 0 },
        },
      ],
    }

    // Post-hoc path
    const exec1 = await executeAbility(ability, {}, ctx)
    const replayEvents = collectExecutionEvents(exec1, 'code_change')
    const replayObligations = evaluateObligations(replayEvents, 'code_change')
    const replayGate = evaluateCompletionGate(replayObligations)

    // Real-time path
    const bus = new ControlEventBus('run_rt_allow', 'code_change')
    const rtCtx: ExecutorContext = { cwd: '/tmp', env: {}, ...createEventCallbacks(bus) }
    const exec2 = await executeAbility(ability, {}, rtCtx)
    const rtEvents = bus.getLog()
    const rtObligations = evaluateObligations(rtEvents, 'code_change')
    const rtGate = evaluateCompletionGate(rtObligations)

    // Both paths should agree
    expect(exec2.status).toBe(exec1.status)
    expect(rtGate.verdict).toBe(replayGate.verdict)
    expect(rtGate.verdict).toBe('warn')
    expect(rtGate.missing).toEqual(replayGate.missing)
    expect(rtGate.failed).toEqual(replayGate.failed)
    expect(rtGate.warnings).toEqual(replayGate.warnings)
    // Both should produce the same event types in the same order
    expect(rtEvents.map(e => e.eventType)).toEqual(replayEvents.map(e => e.eventType))
  })

  test('real-time bus produces same gate result as post-hoc replay (block)', async () => {
    const ability: Ability = {
      name: 'no-tests',
      description: 'Changes code but does not run tests',
      steps: [
        { id: 'implement', type: 'script', run: 'echo "changed code"' },
      ],
    }

    // Post-hoc path
    const exec1 = await executeAbility(ability, {}, ctx)
    const replayEvents = collectExecutionEvents(exec1, 'code_change')
    const replayObligations = evaluateObligations(replayEvents, 'code_change')
    const replayGate = evaluateCompletionGate(replayObligations)

    // Real-time path
    const bus = new ControlEventBus('run_rt_block', 'code_change')
    const rtCtx: ExecutorContext = { cwd: '/tmp', env: {}, ...createEventCallbacks(bus) }
    const exec2 = await executeAbility(ability, {}, rtCtx)
    const rtEvents = bus.getLog()
    const rtObligations = evaluateObligations(rtEvents, 'code_change')
    const rtGate = evaluateCompletionGate(rtObligations)

    expect(exec2.status).toBe(exec1.status)
    expect(rtGate.verdict).toBe(replayGate.verdict)
    expect(rtGate.verdict).toBe('block')
    expect(rtGate.missing).toEqual(replayGate.missing)
    expect(rtGate.failed).toEqual(replayGate.failed)
    expect(rtEvents.map(e => e.eventType)).toEqual(replayEvents.map(e => e.eventType))
  })

  test('real-time bus emits validation.result events for steps with validation', async () => {
    const ability: Ability = {
      name: 'validated-step',
      description: 'Step with validation config',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'exit 0',
          validation: { exit_code: 0 },
        },
      ],
    }

    const bus = new ControlEventBus('run_rt_val', 'code_change')
    const rtCtx: ExecutorContext = { cwd: '/tmp', env: {}, ...createEventCallbacks(bus) }
    await executeAbility(ability, {}, rtCtx)

    const eventTypes = bus.getLog().map(e => e.eventType)
    expect(eventTypes).toContain('validation.result')
    expect(eventTypes).toContain('run.started')
    expect(eventTypes).toContain('run.completed')

    const valEvent = bus.getLog().find(e => e.eventType === 'validation.result')
    expect(valEvent?.payload.passed).toBe(true)
    expect(valEvent?.payload.validator).toBe('script.exit_code')
  })

  test('real-time bus preserves explicit step tags for obligation signaling', async () => {
    const ability: Ability = {
      name: 'rt-tagged-flow',
      description: 'Signals test and commit explicitly',
      steps: [
        {
          id: 'execute-suite',
          type: 'script',
          run: 'echo "suite"',
          tags: ['test'],
          validation: { exit_code: 0 },
        },
        {
          id: 'persist-results',
          type: 'script',
          run: 'echo "saved"',
          tags: ['commit'],
        },
      ],
    }

    const bus = new ControlEventBus('run_rt_tags', 'code_change')
    const rtCtx: ExecutorContext = { cwd: '/tmp', env: {}, ...createEventCallbacks(bus) }
    await executeAbility(ability, {}, rtCtx)

    const obligations = evaluateObligations(bus.getLog(), 'code_change')
    const runTests = obligations.obligations.find((o) => o.key === 'run_tests')
    const commitObligation = obligations.obligations.find((o) => o.key === 'commit_if_required')
    const gate = evaluateCompletionGate(obligations)

    expect(runTests?.status).toBe('satisfied')
    expect(commitObligation?.status).toBe('satisfied')
    expect(gate.verdict).toBe('allow')
  })

  test('real-time bus emits run.failed when a step fails', async () => {
    const ability: Ability = {
      name: 'failing-step',
      description: 'Step that fails validation',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'exit 1',
          validation: { exit_code: 0 },
        },
      ],
    }

    const bus = new ControlEventBus('run_rt_fail', 'code_change')
    const rtCtx: ExecutorContext = { cwd: '/tmp', env: {}, ...createEventCallbacks(bus) }
    const execution = await executeAbility(ability, {}, rtCtx)

    expect(execution.status).toBe('failed')

    const eventTypes = bus.getLog().map(e => e.eventType)
    expect(eventTypes).toContain('run.started')
    expect(eventTypes).toContain('step.failed')
    expect(eventTypes).toContain('run.failed')
    // validation.result should still be emitted before step.failed
    expect(eventTypes).toContain('validation.result')
  })
})

describe('mid-run gate monitor', () => {
  test('tracks gate state transitions during a run', async () => {
    const ability: Ability = {
      name: 'mid-run-transitions',
      description: 'Run tests and then commit',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'exit 0',
          validation: { exit_code: 0 },
        },
        {
          id: 'commit-changes',
          type: 'script',
          run: 'git commit -m "feat: save changes"',
        },
      ],
    }

    const bus = new ControlEventBus('run_mid_1', 'code_change')
    const monitor = new MidRunGateMonitor(bus, 'code_change')
    const execution = await executeAbility(ability, {}, {
      ...ctx,
      ...createEventCallbacks(bus),
    })

    const history = monitor.getHistory()
    const latest = monitor.getLatest()

    expect(execution.status).toBe('completed')
    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history.some((item) => item.verdict === 'warn')).toBe(true)
    expect(latest?.verdict).toBe('allow')
  })

  test('captures block state when hard obligations fail in-flight', async () => {
    const ability: Ability = {
      name: 'mid-run-block',
      description: 'Validation fails before run completion',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'exit 1',
          validation: { exit_code: 0 },
        },
      ],
    }

    const bus = new ControlEventBus('run_mid_2', 'code_change')
    const monitor = new MidRunGateMonitor(bus, 'code_change')

    await executeAbility(ability, {}, {
      ...ctx,
      ...createEventCallbacks(bus),
    })

    const latest = monitor.getLatest()
    expect(latest?.verdict).toBe('block')
    expect(latest?.failed).toContain('run_tests')
  })

  test('history only records meaningful gate changes', () => {
    const bus = new ControlEventBus('run_mid_3', 'code_change')
    const monitor = new MidRunGateMonitor(bus, 'code_change')

    bus.emit(
      'run.started',
      { kind: 'system', id: 'execution-manager' },
      { ability: 'demo' },
      { ability: 'demo' }
    )
    expect(monitor.getHistory()).toHaveLength(0)

    bus.emit(
      'step.completed',
      { kind: 'system', id: 'executor' },
      { ability: 'demo', stepId: 'run-tests', stepType: 'script' },
      { command: 'exit 0' }
    )
    bus.emit(
      'validation.result',
      { kind: 'system', id: 'executor' },
      { ability: 'demo', stepId: 'run-tests', stepType: 'script' },
      { validator: 'script.exit_code', passed: true, expectedExitCode: 0, actualExitCode: 0 }
    )
    bus.emit(
      'step.completed',
      { kind: 'system', id: 'executor' },
      { ability: 'demo', stepId: 'commit-changes', stepType: 'script' },
      { command: 'git commit -m "done"' }
    )

    const history = monitor.getHistory()
    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history[history.length - 1]?.verdict).toBe('allow')
  })
})

describe('model drift audit', () => {
  test('records observed model usage without drift when actual matches expected', async () => {
    const ability: Ability = {
      name: 'agent-model-match',
      description: 'Agent step uses the expected model',
      steps: [
        {
          id: 'review',
          type: 'agent',
          agent: 'reviewer',
          prompt: 'Review the code',
          model: 'gpt-5.4',
          provider: 'openai',
        },
      ],
    }

    const execution = await executeAbility(ability, {}, {
      cwd: '/tmp',
      env: {},
      agents: {
        async call() {
          return { output: 'done', model: 'gpt-5.4', provider: 'openai' }
        },
        async background() {
          return { output: 'done', model: 'gpt-5.4', provider: 'openai' }
        },
      },
    })

    const audit = evaluateModelDrift(collectExecutionEvents(execution, 'code_change'))

    expect(audit.observed).toBe(1)
    expect(audit.driftCount).toBe(0)
    expect(audit.drifts[0]?.drifted).toBe(false)
  })

  test('detects model drift when actual model differs from expected', async () => {
    const ability: Ability = {
      name: 'agent-model-drift',
      description: 'Agent step drifts to another model',
      steps: [
        {
          id: 'review',
          type: 'agent',
          agent: 'reviewer',
          prompt: 'Review the code',
          model: 'gpt-5.4',
          provider: 'openai',
        },
      ],
    }

    const execution = await executeAbility(ability, {}, {
      cwd: '/tmp',
      env: {},
      agents: {
        async call() {
          return { output: 'done', model: 'gpt-4.1', provider: 'openai' }
        },
        async background() {
          return { output: 'done', model: 'gpt-4.1', provider: 'openai' }
        },
      },
    })

    const audit = evaluateModelDrift(collectExecutionEvents(execution, 'code_change'))

    expect(audit.observed).toBe(1)
    expect(audit.driftCount).toBe(1)
    expect(audit.drifts[0]?.drifted).toBe(true)
    expect(audit.drifts[0]?.reasons[0]).toContain('Expected model')
  })
})
