import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { ControlEventFactory, generateEventId } from '../src/control/events.js'
import type {
  ControlEvent,
  RunStartedPayload,
  RunCompletedPayload,
  StepStartedPayload,
  StepCompletedPayload,
  ToolCalledPayload,
  ValidationResultPayload,
  ObligationSignalPayload,
  ModelObservedPayload,
} from '../src/control/events.js'
import { ControlEventBus } from '../src/control/event-bus.js'
import { EventLog } from '../src/control/event-log.js'
import { evaluateControlFromEvents } from '../src/control/index.js'
import { executeAbility } from '../src/executor/index.js'
import type { Ability, ExecutorContext } from '../src/types/index.js'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const createMockContext = (): ExecutorContext => ({
  cwd: process.cwd(),
  env: {},
})

// ─────────────────────────────────────────────────────────────
// generateEventId
// ─────────────────────────────────────────────────────────────

describe('generateEventId', () => {
  it('returns unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateEventId())
    }
    expect(ids.size).toBe(100)
  })

  it('prefixes with evt_', () => {
    const id = generateEventId()
    expect(id.startsWith('evt_')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// ControlEventFactory
// ─────────────────────────────────────────────────────────────

describe('ControlEventFactory', () => {
  let factory: ControlEventFactory

  beforeEach(() => {
    factory = new ControlEventFactory({
      run_id: 'run_test_001',
      session_id: 'sess_001',
      ability_execution_id: 'exec_001',
    })
  })

  it('creates events with shared metadata', () => {
    const event = factory.runStarted('my-ability', { key: 'val' })
    expect(event.run_id).toBe('run_test_001')
    expect(event.session_id).toBe('sess_001')
    expect(event.ability_execution_id).toBe('exec_001')
    expect(event.source).toBe('openagentscontrol')
    expect(event.id).toBeTruthy()
    expect(event.ts).toBeTruthy()
  })

  it('allows custom source', () => {
    const custom = new ControlEventFactory({
      run_id: 'run_test_002',
      source: 'custom-source',
    })
    const event = custom.runStarted('my-ability', {})
    expect(event.source).toBe('custom-source')
  })

  describe('runStarted', () => {
    it('creates run.started event', () => {
      const event = factory.runStarted('my-ability', { query: 'test' }, 'manual')
      expect(event.event_type).toBe('run.started')
      expect(event.actor).toEqual({ kind: 'system', id: 'executor' })
      expect(event.context.ability).toBe('my-ability')
      const payload = event.payload as RunStartedPayload
      expect(payload.ability).toBe('my-ability')
      expect(payload.inputs).toEqual({ query: 'test' })
      expect(payload.trigger).toBe('manual')
    })

    it('uses default trigger', () => {
      const event = factory.runStarted('my-ability', {})
      expect((event.payload as RunStartedPayload).trigger).toBe('ability.run')
    })
  })

  describe('runCompleted', () => {
    it('creates run.completed event with gate verdict', () => {
      const event = factory.runCompleted('my-ability', 'completed', 1500, 'allow')
      expect(event.event_type).toBe('run.completed')
      const payload = event.payload as RunCompletedPayload
      expect(payload.status).toBe('completed')
      expect(payload.duration_ms).toBe(1500)
      expect(payload.gate_verdict).toBe('allow')
    })
  })

  describe('runFailed', () => {
    it('creates run.failed event', () => {
      const event = factory.runFailed('my-ability', 500, 'timeout')
      expect(event.event_type).toBe('run.failed')
      const payload = event.payload as RunCompletedPayload
      expect(payload.status).toBe('failed')
      expect(payload.duration_ms).toBe(500)
    })
  })

  describe('stepStarted', () => {
    it('creates step.started event', () => {
      const event = factory.stepStarted('my-ability', 'step-1', 'script', ['step-0'])
      expect(event.event_type).toBe('step.started')
      expect(event.context.step_id).toBe('step-1')
      expect(event.context.step_type).toBe('script')
      const payload = event.payload as StepStartedPayload
      expect(payload.step_id).toBe('step-1')
      expect(payload.needs).toEqual(['step-0'])
    })
  })

  describe('stepCompleted', () => {
    it('creates step.completed event with extras', () => {
      const event = factory.stepCompleted('my-ability', 'step-1', 'script', 'completed', 200, {
        tags: ['test', 'validation'],
        output: 'All tests passed',
      })
      expect(event.event_type).toBe('step.completed')
      const payload = event.payload as StepCompletedPayload
      expect(payload.step_id).toBe('step-1')
      expect(payload.status).toBe('completed')
      expect(payload.duration_ms).toBe(200)
      expect(payload.tags).toEqual(['test', 'validation'])
      expect(payload.output).toBe('All tests passed')
    })
  })

  describe('stepFailed', () => {
    it('creates step.failed event', () => {
      const event = factory.stepFailed('my-ability', 'step-2', 'script', 100, 'exit code 1')
      expect(event.event_type).toBe('step.failed')
      const payload = event.payload as StepCompletedPayload
      expect(payload.status).toBe('failed')
      expect(payload.error).toBe('exit code 1')
    })
  })

  describe('toolCalled', () => {
    it('creates tool.called event', () => {
      const event = factory.toolCalled('my-ability', 'bash', true, {
        step_id: 'step-1',
        enforcement_mode: 'enforce',
      })
      expect(event.event_type).toBe('tool.called')
      expect(event.actor).toEqual({ kind: 'tool', id: 'bash' })
      const payload = event.payload as ToolCalledPayload
      expect(payload.tool).toBe('bash')
      expect(payload.allowed).toBe(true)
      expect(payload.enforcement_mode).toBe('enforce')
    })
  })

  describe('validationResult', () => {
    it('creates validation.result event', () => {
      const event = factory.validationResult('my-ability', 'step-1', 'exit_code', 0, 0, true)
      expect(event.event_type).toBe('validation.result')
      const payload = event.payload as ValidationResultPayload
      expect(payload.validator).toBe('exit_code')
      expect(payload.expected).toBe(0)
      expect(payload.actual).toBe(0)
      expect(payload.passed).toBe(true)
    })
  })

  describe('obligationSignal', () => {
    it('creates obligation.signal event', () => {
      const event = factory.obligationSignal('my-ability', 'run_tests', 'step_completed', {
        step_id: 'test-step',
        status: 'completed',
      })
      expect(event.event_type).toBe('obligation.signal')
      const payload = event.payload as ObligationSignalPayload
      expect(payload.obligation_key).toBe('run_tests')
      expect(payload.signal_type).toBe('step_completed')
      expect(payload.evidence).toEqual({ step_id: 'test-step', status: 'completed' })
    })
  })

  describe('modelObserved', () => {
    it('creates model.observed event with drift', () => {
      const event = factory.modelObserved('my-ability', true, 'response-header', {
        expected_model: 'gpt-4',
        actual_model: 'gpt-3.5-turbo',
      })
      expect(event.event_type).toBe('model.observed')
      const payload = event.payload as ModelObservedPayload
      expect(payload.drift).toBe(true)
      expect(payload.expected_model).toBe('gpt-4')
      expect(payload.actual_model).toBe('gpt-3.5-turbo')
    })

    it('creates model.observed event without drift', () => {
      const event = factory.modelObserved('my-ability', false, 'api')
      expect(event.event_type).toBe('model.observed')
      const payload = event.payload as ModelObservedPayload
      expect(payload.drift).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// ControlEventBus
// ─────────────────────────────────────────────────────────────

describe('ControlEventBus', () => {
  let bus: ControlEventBus
  let factory: ControlEventFactory

  beforeEach(() => {
    bus = new ControlEventBus()
    factory = new ControlEventFactory({ run_id: 'run_bus_001' })
  })

  it('stores events per run', () => {
    bus.emit(factory.runStarted('ability-a', {}))
    bus.emit(factory.stepStarted('ability-a', 'step-1', 'script'))

    const events = bus.getRunEvents('run_bus_001')
    expect(events).toHaveLength(2)
    expect(events[0].event_type).toBe('run.started')
    expect(events[1].event_type).toBe('step.started')
  })

  it('isolates events between runs', () => {
    const factory2 = new ControlEventFactory({ run_id: 'run_bus_002' })

    bus.emit(factory.runStarted('ability-a', {}))
    bus.emit(factory2.runStarted('ability-b', {}))

    expect(bus.getRunEvents('run_bus_001')).toHaveLength(1)
    expect(bus.getRunEvents('run_bus_002')).toHaveLength(1)
  })

  it('returns empty array for unknown run', () => {
    expect(bus.getRunEvents('nonexistent')).toHaveLength(0)
  })

  describe('typed subscribers', () => {
    it('delivers events matching subscribed type', () => {
      const received: ControlEvent[] = []
      bus.on('step.completed', (event) => received.push(event))

      bus.emit(factory.runStarted('a', {}))
      bus.emit(factory.stepCompleted('a', 's1', 'script', 'completed', 100))
      bus.emit(factory.stepStarted('a', 's2', 'script'))

      expect(received).toHaveLength(1)
      expect(received[0].event_type).toBe('step.completed')
    })

    it('unsubscribe stops delivery', () => {
      const received: ControlEvent[] = []
      const unsub = bus.on('run.started', (event) => received.push(event))

      bus.emit(factory.runStarted('a', {}))
      expect(received).toHaveLength(1)

      unsub()
      bus.emit(factory.runStarted('b', {}))
      expect(received).toHaveLength(1)
    })
  })

  describe('wildcard subscribers', () => {
    it('receives all event types', () => {
      const received: ControlEvent[] = []
      bus.onAll((event) => received.push(event))

      bus.emit(factory.runStarted('a', {}))
      bus.emit(factory.stepStarted('a', 's1', 'script'))
      bus.emit(factory.stepCompleted('a', 's1', 'script', 'completed', 50))

      expect(received).toHaveLength(3)
    })

    it('unsubscribe stops wildcard delivery', () => {
      const received: ControlEvent[] = []
      const unsub = bus.onAll((event) => received.push(event))

      bus.emit(factory.runStarted('a', {}))
      unsub()
      bus.emit(factory.stepStarted('a', 's1', 'script'))

      expect(received).toHaveLength(1)
    })
  })

  describe('getRunEventsByType', () => {
    it('filters events by type', () => {
      bus.emit(factory.runStarted('a', {}))
      bus.emit(factory.stepStarted('a', 's1', 'script'))
      bus.emit(factory.stepCompleted('a', 's1', 'script', 'completed', 100))
      bus.emit(factory.stepStarted('a', 's2', 'script'))
      bus.emit(factory.stepCompleted('a', 's2', 'script', 'completed', 200))

      const stepCompletedEvents = bus.getRunEventsByType('run_bus_001', 'step.completed')
      expect(stepCompletedEvents).toHaveLength(2)
    })
  })

  describe('clearRun', () => {
    it('removes events for a specific run', () => {
      bus.emit(factory.runStarted('a', {}))
      expect(bus.getRunEvents('run_bus_001')).toHaveLength(1)

      bus.clearRun('run_bus_001')
      expect(bus.getRunEvents('run_bus_001')).toHaveLength(0)
    })
  })

  describe('reset', () => {
    it('clears all state', () => {
      const received: ControlEvent[] = []
      bus.on('run.started', (event) => received.push(event))
      bus.emit(factory.runStarted('a', {}))

      bus.reset()

      // Events cleared
      expect(bus.getRunEvents('run_bus_001')).toHaveLength(0)

      // Subscribers cleared - new events not delivered to old subscribers
      bus.emit(factory.runStarted('b', {}))
      expect(received).toHaveLength(1) // only the first one
    })
  })

  describe('maxEventsPerRun', () => {
    it('enforces per-run event limit', () => {
      const limitedBus = new ControlEventBus({ maxEventsPerRun: 3 })

      for (let i = 0; i < 10; i++) {
        limitedBus.emit(factory.stepStarted('a', `step-${i}`, 'script'))
      }

      expect(limitedBus.getRunEvents('run_bus_001')).toHaveLength(3)
    })
  })

  describe('subscriber error isolation', () => {
    it('continues delivering to other subscribers when one throws', () => {
      const received: ControlEvent[] = []
      bus.onAll(() => { throw new Error('subscriber crash') })
      bus.onAll((event) => received.push(event))

      // Should not throw, and second subscriber still receives
      bus.emit(factory.runStarted('a', {}))
      expect(received).toHaveLength(1)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// EventLog (JSONL Persistence)
// ─────────────────────────────────────────────────────────────

describe('EventLog', () => {
  let tmpDir: string
  let log: EventLog
  let factory: ControlEventFactory

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'event-log-test-'))
    log = new EventLog({ logDir: tmpDir })
    factory = new ControlEventFactory({ run_id: 'run_log_001' })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('append and readRun', () => {
    it('persists and reads events', async () => {
      const event1 = factory.runStarted('my-ability', { q: 'test' })
      const event2 = factory.stepStarted('my-ability', 'step-1', 'script')

      await log.append(event1)
      await log.append(event2)

      const events = await log.readRun('run_log_001')
      expect(events).toHaveLength(2)
      expect(events[0].event_type).toBe('run.started')
      expect(events[1].event_type).toBe('step.started')
    })

    it('returns empty array for missing run', async () => {
      const events = await log.readRun('nonexistent')
      expect(events).toHaveLength(0)
    })
  })

  describe('appendBatch', () => {
    it('writes multiple events atomically', async () => {
      const events = [
        factory.runStarted('a', {}),
        factory.stepStarted('a', 's1', 'script'),
        factory.stepCompleted('a', 's1', 'script', 'completed', 100),
      ]

      await log.appendBatch(events)

      const read = await log.readRun('run_log_001')
      expect(read).toHaveLength(3)
    })

    it('handles empty batch', async () => {
      await log.appendBatch([])
      const events = await log.readRun('run_log_001')
      expect(events).toHaveLength(0)
    })
  })

  describe('per-run files', () => {
    it('creates separate files per run', async () => {
      const factory2 = new ControlEventFactory({ run_id: 'run_log_002' })

      await log.append(factory.runStarted('a', {}))
      await log.append(factory2.runStarted('b', {}))

      const run1Events = await log.readRun('run_log_001')
      const run2Events = await log.readRun('run_log_002')
      expect(run1Events).toHaveLength(1)
      expect(run2Events).toHaveLength(1)
    })
  })

  describe('unified log mode', () => {
    it('writes all events to single file', async () => {
      const unifiedLog = new EventLog({ logDir: tmpDir, perRunFiles: false })
      const factory2 = new ControlEventFactory({ run_id: 'run_log_002' })

      await unifiedLog.append(factory.runStarted('a', {}))
      await unifiedLog.append(factory2.runStarted('b', {}))

      // Read only run_log_001
      const run1Events = await unifiedLog.readRun('run_log_001')
      expect(run1Events).toHaveLength(1)
      expect(run1Events[0].run_id).toBe('run_log_001')
    })
  })

  describe('hasRun', () => {
    it('returns false for missing run', () => {
      expect(log.hasRun('nonexistent')).toBe(false)
    })

    it('returns true after writing events', async () => {
      await log.append(factory.runStarted('a', {}))
      expect(log.hasRun('run_log_001')).toBe(true)
    })
  })

  describe('JSONL format', () => {
    it('writes one JSON object per line', async () => {
      await log.append(factory.runStarted('a', {}))
      await log.append(factory.stepStarted('a', 's1', 'script'))

      const rawContent = await readFile(join(tmpDir, 'run_log_001.jsonl'), 'utf-8')
      const lines = rawContent.trim().split('\n')
      expect(lines).toHaveLength(2)

      // Each line is valid JSON
      for (const line of lines) {
        const parsed = JSON.parse(line)
        expect(parsed.id).toBeTruthy()
        expect(parsed.event_type).toBeTruthy()
      }
    })
  })

  describe('corrupt line handling', () => {
    it('skips corrupt lines and reads valid ones', async () => {
      const { appendFile } = await import('fs/promises')
      const logPath = join(tmpDir, 'run_log_001.jsonl')

      // Write valid event
      await log.append(factory.runStarted('a', {}))

      // Inject a corrupt line
      await appendFile(logPath, 'THIS IS NOT JSON\n', 'utf-8')

      // Write another valid event
      await log.append(factory.stepStarted('a', 's1', 'script'))

      const events = await log.readRun('run_log_001')
      expect(events).toHaveLength(2) // corrupt line skipped
    })
  })
})

// ─────────────────────────────────────────────────────────────
// EventBus + EventLog integration
// ─────────────────────────────────────────────────────────────

describe('EventBus + EventLog integration', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bus-log-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('bus persists events to log automatically', async () => {
    const log = new EventLog({ logDir: tmpDir })
    const bus = new ControlEventBus({ log })
    const factory = new ControlEventFactory({ run_id: 'run_integrated_001' })

    bus.emit(factory.runStarted('a', {}))
    bus.emit(factory.stepStarted('a', 's1', 'script'))

    // Wait for async log writes (fire-and-forget)
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Read from log (disk), not from bus (memory)
    const diskEvents = await log.readRun('run_integrated_001')
    expect(diskEvents).toHaveLength(2)

    // Verify both event types are present (async writes may reorder)
    const types = diskEvents.map(e => e.event_type).sort()
    expect(types).toContain('run.started')
    expect(types).toContain('step.started')
  })
})

// ─────────────────────────────────────────────────────────────
// evaluateControlFromEvents
// ─────────────────────────────────────────────────────────────

describe('evaluateControlFromEvents', () => {
  let factory: ControlEventFactory

  beforeEach(() => {
    factory = new ControlEventFactory({ run_id: 'run_ctrl_001' })
  })

  it('returns undefined for ability without task_type', () => {
    const ability: Ability = {
      name: 'no-task-type',
      description: 'No task type',
      steps: [],
    }
    const result = evaluateControlFromEvents(ability, [])
    expect(result).toBeUndefined()
  })

  it('blocks when hard obligations are missing (no events)', () => {
    const ability: Ability = {
      name: 'paper-review',
      description: 'Review',
      task_type: 'paper_fulltext_review',
      steps: [],
    }

    const result = evaluateControlFromEvents(ability, [])
    expect(result).toBeDefined()
    expect(result!.gate.verdict).toBe('block')
    expect(result!.obligations.find(o => o.key === 'extract_fulltext')?.status).toBe('missing')
    expect(result!.obligations.find(o => o.key === 'record_reading_card')?.status).toBe('missing')
  })

  it('allows when hard obligations are satisfied via step.completed events', () => {
    const ability: Ability = {
      name: 'paper-review',
      description: 'Review',
      task_type: 'paper_fulltext_review',
      steps: [],
    }

    const events = [
      factory.stepCompleted('paper-review', 'extract-step', 'script', 'completed', 500, {
        tags: ['fulltext-extract'],
      }),
      factory.stepCompleted('paper-review', 'card-step', 'script', 'completed', 300, {
        tags: ['reading-card'],
      }),
    ]

    const result = evaluateControlFromEvents(ability, events)
    expect(result!.gate.verdict).toBe('allow')
    expect(result!.obligations.every(o => o.status === 'satisfied')).toBe(true)
  })

  it('blocks when a hard obligation step failed', () => {
    const ability: Ability = {
      name: 'paper-review',
      description: 'Review',
      task_type: 'paper_fulltext_review',
      steps: [],
    }

    const events = [
      factory.stepCompleted('paper-review', 'extract-step', 'script', 'completed', 500, {
        tags: ['fulltext-extract'],
      }),
      // reading-card step failed — tags are still recorded for obligation tracking
      factory.stepFailed('paper-review', 'card-step', 'script', 200, 'script error', ['reading-card']),
    ]

    // stepFailed creates a step.failed event with StepCompletedPayload (status: 'failed')
    const result = evaluateControlFromEvents(ability, events)
    expect(result!.gate.verdict).toBe('block')
    expect(result!.obligations.find(o => o.key === 'record_reading_card')?.status).toBe('failed')
  })

  it('warns on missing soft obligation for code_change', () => {
    const ability: Ability = {
      name: 'code-change',
      description: 'Change',
      task_type: 'code_change',
      steps: [],
    }

    const events = [
      factory.stepCompleted('code-change', 'test-step', 'script', 'completed', 100, {
        tags: ['test'],
      }),
      factory.stepCompleted('code-change', 'validate-step', 'script', 'completed', 100, {
        tags: ['validation'],
      }),
      // no commit step → soft obligation 'commit_if_required' is missing
    ]

    const result = evaluateControlFromEvents(ability, events)
    expect(result!.gate.verdict).toBe('warn')
    expect(result!.gate.warnings).toContain('Missing soft obligation: commit_if_required')
  })

  it('collects evidence step IDs from events', () => {
    const ability: Ability = {
      name: 'code-change',
      description: 'Change',
      task_type: 'code_change',
      steps: [],
    }

    const events = [
      factory.stepCompleted('code-change', 'test-step', 'script', 'completed', 100, {
        tags: ['test'],
      }),
    ]

    const result = evaluateControlFromEvents(ability, events)
    const testObligation = result!.obligations.find(o => o.key === 'run_tests')
    expect(testObligation?.evidenceStepIds).toContain('test-step')
  })
})

// ─────────────────────────────────────────────────────────────
// Executor event emission
// ─────────────────────────────────────────────────────────────

describe('executor event emission', () => {
  let bus: ControlEventBus

  beforeEach(() => {
    bus = new ControlEventBus()
  })

  it('emits run lifecycle events for a successful run', async () => {
    const ability: Ability = {
      name: 'simple-echo',
      description: 'Simple test',
      steps: [
        { id: 'echo', type: 'script', run: 'echo hello' },
      ],
    }

    await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    // Find the run_id from the first event
    const allRuns = [...new Set(
      bus.getRunEvents('').length === 0
        ? [] // need to find run IDs from events emitted
        : []
    )]

    // Since we don't know run_id in advance, collect from wildcard
    const allEvents: ControlEvent[] = []
    const freshBus = new ControlEventBus()
    freshBus.onAll((e) => allEvents.push(e))

    await executeAbility(ability, {}, createMockContext(), { eventBus: freshBus })

    expect(allEvents.length).toBeGreaterThanOrEqual(4) // run.started, step.started, step.completed, run.completed
    expect(allEvents[0].event_type).toBe('run.started')
    expect(allEvents[1].event_type).toBe('step.started')
    expect(allEvents[2].event_type).toBe('step.completed')

    // Last event should be run.completed
    const lastEvent = allEvents[allEvents.length - 1]
    expect(lastEvent.event_type).toBe('run.completed')
  })

  it('emits run.failed event when a step fails', async () => {
    const ability: Ability = {
      name: 'failing-ability',
      description: 'Fails',
      steps: [
        { id: 'fail', type: 'script', run: 'exit 1', validation: { exit_code: 0 } },
      ],
    }

    const allEvents: ControlEvent[] = []
    bus.onAll((e) => allEvents.push(e))

    await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    const eventTypes = allEvents.map(e => e.event_type)
    expect(eventTypes).toContain('run.started')
    expect(eventTypes).toContain('step.started')
    expect(eventTypes).toContain('step.failed')
    expect(eventTypes).toContain('run.failed')
  })

  it('emits obligation.signal for steps with tags', async () => {
    const ability: Ability = {
      name: 'tagged-ability',
      description: 'Has tags',
      task_type: 'code_change',
      steps: [
        { id: 'test', type: 'script', run: 'echo test', tags: ['test'] },
        { id: 'validate', type: 'script', run: 'echo validate', tags: ['validation'] },
        { id: 'commit', type: 'script', run: 'echo commit', tags: ['commit'] },
      ],
    }

    const allEvents: ControlEvent[] = []
    bus.onAll((e) => allEvents.push(e))

    await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    const obligationSignals = allEvents.filter(e => e.event_type === 'obligation.signal')
    expect(obligationSignals.length).toBeGreaterThanOrEqual(3) // test, validation, commit

    const signalKeys = obligationSignals.map(e => (e.payload as ObligationSignalPayload).obligation_key)
    expect(signalKeys).toContain('test')
    expect(signalKeys).toContain('validation')
    expect(signalKeys).toContain('commit')
  })

  it('emits validation.result for steps with exit_code validation', async () => {
    const ability: Ability = {
      name: 'validated-ability',
      description: 'Has validation',
      steps: [
        { id: 'checked', type: 'script', run: 'echo ok', validation: { exit_code: 0 } },
      ],
    }

    const allEvents: ControlEvent[] = []
    bus.onAll((e) => allEvents.push(e))

    await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    const validationEvents = allEvents.filter(e => e.event_type === 'validation.result')
    expect(validationEvents).toHaveLength(1)

    const payload = validationEvents[0].payload as ValidationResultPayload
    expect(payload.validator).toBe('script.exit_code')
    expect(payload.passed).toBe(true)
  })

  it('emits run.failed for input validation failure', async () => {
    const ability: Ability = {
      name: 'input-fail',
      description: 'Needs input',
      inputs: { name: { type: 'string', required: true } },
      steps: [
        { id: 'greet', type: 'script', run: 'echo hi' },
      ],
    }

    const allEvents: ControlEvent[] = []
    bus.onAll((e) => allEvents.push(e))

    await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    const eventTypes = allEvents.map(e => e.event_type)
    expect(eventTypes).toContain('run.started')
    expect(eventTypes).toContain('run.failed')
    expect(allEvents).toHaveLength(2) // only run.started + run.failed
  })

  it('uses event-based obligation evaluation when bus is provided', async () => {
    const ability: Ability = {
      name: 'event-eval-test',
      description: 'Tests event-based evaluation path',
      task_type: 'paper_fulltext_review',
      steps: [
        { id: 'extract', type: 'script', run: 'echo extract', tags: ['fulltext-extract'] },
        { id: 'card', type: 'script', run: 'echo card', tags: ['reading-card'], needs: ['extract'] },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    // Should use event-based evaluation and get allow verdict
    expect(execution.control).toBeDefined()
    expect(execution.control!.gate.verdict).toBe('allow')
    expect(execution.control!.obligations.every(o => o.status === 'satisfied')).toBe(true)
  })

  it('all events share the same run_id', async () => {
    const ability: Ability = {
      name: 'run-id-test',
      description: 'Test',
      steps: [
        { id: 'a', type: 'script', run: 'echo a' },
        { id: 'b', type: 'script', run: 'echo b', needs: ['a'] },
      ],
    }

    const allEvents: ControlEvent[] = []
    bus.onAll((e) => allEvents.push(e))

    await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    const runIds = new Set(allEvents.map(e => e.run_id))
    expect(runIds.size).toBe(1)
  })

  it('all events share the same ability_execution_id', async () => {
    const ability: Ability = {
      name: 'exec-id-test',
      description: 'Test',
      steps: [
        { id: 'a', type: 'script', run: 'echo a' },
      ],
    }

    const allEvents: ControlEvent[] = []
    bus.onAll((e) => allEvents.push(e))

    await executeAbility(ability, {}, createMockContext(), { eventBus: bus })

    const execIds = new Set(allEvents.map(e => e.ability_execution_id))
    expect(execIds.size).toBe(1)
    expect(allEvents[0].ability_execution_id).toBeTruthy()
  })

  it('preserves backward compatibility when no eventBus provided', async () => {
    const ability: Ability = {
      name: 'no-bus-test',
      description: 'Test without bus',
      task_type: 'paper_fulltext_review',
      steps: [
        { id: 'extract', type: 'script', run: 'echo extract', tags: ['fulltext-extract'] },
        { id: 'card', type: 'script', run: 'echo card', tags: ['reading-card'], needs: ['extract'] },
      ],
    }

    // No eventBus — should use original step-based evaluation
    const execution = await executeAbility(ability, {}, createMockContext())

    expect(execution.control).toBeDefined()
    expect(execution.control!.gate.verdict).toBe('allow')
  })
})
