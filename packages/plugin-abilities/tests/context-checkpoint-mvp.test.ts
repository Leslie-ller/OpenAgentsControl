import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import type { AbilityExecution } from '../src/types/index.js'
import { resolveTopicFromExecution } from '../src/runtime/context/topic-resolver.js'
import { CheckpointStore } from '../src/runtime/context/checkpoint-store.js'
import { renderFocusRefreshBlock } from '../src/runtime/context/focus-refresh.js'
import { renderDetailReinjectionBlock, selectDetailFields } from '../src/runtime/context/detail-reinjector.js'
import { createCompactionCheckpoint } from '../src/runtime/context/compaction-checkpoint.js'
import { PendingCheckpointSummaries } from '../src/runtime/context/pending-checkpoint-summaries.js'
import { ControlEventBus } from '../src/control/event-bus.js'
import { EventLog } from '../src/control/event-log.js'
import { ExecutionManager } from '../src/executor/execution-manager.js'

function makeExecution(overrides?: Partial<AbilityExecution>): AbilityExecution {
  return {
    id: 'exec_topic_1',
    ability: {
      name: 'development/code-change',
      description: 'test',
      task_type: 'code_change',
      steps: [],
    },
    inputs: {
      objective: 'Implement context checkpoint flow',
      task_id: 'task_001',
    },
    status: 'completed',
    executionStatus: 'completed',
    currentStep: null,
    currentStepIndex: -1,
    completedSteps: [
      {
        stepId: 'execute',
        status: 'completed',
        output: JSON.stringify({
          implementation_summary: 'Implemented checkpointing support',
          changed_files: ['src/runtime/context/checkpoint-store.ts'],
        }),
        startedAt: Date.now() - 50,
        completedAt: Date.now() - 40,
        duration: 10,
      },
      {
        stepId: 'validate',
        status: 'completed',
        output: JSON.stringify({
          commands: ['bun test'],
          validated_claims: ['checkpoint store write works'],
        }),
        startedAt: Date.now() - 30,
        completedAt: Date.now() - 20,
        duration: 10,
      },
    ],
    pendingSteps: [],
    startedAt: Date.now() - 100,
    completedAt: Date.now(),
    control: {
      taskType: 'code_change',
      obligations: [],
      gate: { verdict: 'allow', reasons: [], warnings: [] },
    },
    ...overrides,
  }
}

async function runExecutionForCheckpoint(
  tempDir: string,
  inputs: Record<string, unknown>,
): Promise<AbilityExecution> {
  const eventLog = new EventLog({ logDir: path.join(tempDir, 'control-logs') })
  const eventBus = new ControlEventBus({ log: eventLog })
  const manager = new ExecutionManager(eventBus)

  const ability = {
    name: 'context-checkpoint-test',
    description: 'checkpoint test ability',
    task_type: 'code_change' as const,
    steps: [
      {
        id: 'execute',
        type: 'script' as const,
        run: 'python3 - <<\'PY\'\nimport json\nprint(json.dumps({"implementation_summary":"done","changed_files":["src/runtime/context/checkpoint-store.ts"]}))\nPY',
      },
      {
        id: 'validate',
        type: 'script' as const,
        run: 'python3 - <<\'PY\'\nimport json\nprint(json.dumps({"commands":["bun test"],"validated_claims":["ok"],"verdict":"pass"}))\nPY',
      },
    ],
  }

  const execution = await manager.execute(ability as any, inputs, {
    cwd: tempDir,
    env: {},
  })

  return execution
}

describe('context checkpoint MVP runtime', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-checkpoint-mvp-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('resolves stable topic from explicit input and falls back to task type', () => {
    const explicit = makeExecution({ inputs: { topic: 'Coding Workflow' } })
    expect(resolveTopicFromExecution(explicit)).toBe('coding-workflow')

    const fallback = makeExecution({ inputs: {} })
    expect(resolveTopicFromExecution(fallback)).toBe('code-change')
  })

  it('stores state/detail capsules by topic with overwrite semantics', async () => {
    const store = new CheckpointStore({ rootDir: path.join(tempDir, 'checkpoints') })

    await store.saveState({
      topic: 'coding-workflow',
      current_state: 'state-v1',
      based_on: ['plan-v1'],
      next_action: 'next-v1',
      open_questions: [],
      key_constraints: [],
      updated_at: '2026-03-18T00:00:00.000Z',
    })
    await store.saveState({
      topic: 'coding-workflow',
      current_state: 'state-v2',
      based_on: ['plan-v2'],
      next_action: 'next-v2',
      open_questions: [],
      key_constraints: [],
      updated_at: '2026-03-18T00:01:00.000Z',
    })

    const loaded = await store.loadState('coding-workflow')
    expect(loaded).not.toBeNull()
    expect(loaded!.current_state).toBe('state-v2')

    await store.saveDetail({
      topic: 'bibliography-remediation',
      critical_details: ['detail-a'],
      decisions: ['decision-a'],
      evidence: ['evidence-a'],
      file_refs: ['file-a'],
      commands_run: ['cmd-a'],
      unresolved_edges: [],
      updated_at: '2026-03-18T00:02:00.000Z',
    })
    const isolated = await store.loadDetail('bibliography-remediation')
    expect(isolated).not.toBeNull()
    expect(isolated!.critical_details).toEqual(['detail-a'])
    expect(await store.loadDetail('coding-workflow')).toBeNull()
  })

  it('renders short focus refresh block from state capsule', () => {
    const block = renderFocusRefreshBlock({
      topic: 'coding-workflow',
      current_state: 'Checkpoint store implemented',
      based_on: ['context-compaction-checkpoint-mvp.md'],
      next_action: 'Implement compaction hook checkpoint write',
      open_questions: ['How to inject compaction summary safely?'],
      key_constraints: ['Keep injected context short'],
      updated_at: '2026-03-18T00:03:00.000Z',
    }, 'pre_high_impact_decision')

    expect(block).toContain('Current Focus:')
    expect(block).toContain('topic: coding-workflow')
    expect(block).toContain('trigger: pre_high_impact_decision')
  })

  it('selectively reinjects detail fields by use case', () => {
    const detail = {
      topic: 'coding-workflow',
      critical_details: ['critical-a'],
      decisions: ['decision-a'],
      evidence: ['evidence-a'],
      file_refs: ['src/a.ts'],
      commands_run: ['bun test'],
      unresolved_edges: ['edge-a'],
      updated_at: '2026-03-18T00:04:00.000Z',
    }

    const impl = selectDetailFields(detail, 'continue_implementation')
    expect(Object.keys(impl)).toEqual(['critical_details', 'decisions'])

    const recover = selectDetailFields(detail, 'recover_execution_context')
    expect(Object.keys(recover)).toEqual(['file_refs', 'commands_run'])
  })

  it('renders detail reinjection block from selected fields', () => {
    const block = renderDetailReinjectionBlock('coding-workflow', {
      decisions: ['review_verdict:pass'],
      evidence: ['validation passed'],
    })

    expect(block).toContain('Detail Reinjection:')
    expect(block).toContain('topic: coding-workflow')
    expect(block).toContain('decisions:')
    expect(block).toContain('  - review_verdict:pass')
  })

  it('creates compaction checkpoint and stores state/detail capsules', async () => {
    const store = new CheckpointStore({ rootDir: path.join(tempDir, 'checkpoints') })
    const execution = makeExecution()

    const checkpoint = await createCompactionCheckpoint(execution, store)
    expect(checkpoint.topic).toBe('code-change')
    expect(checkpoint.summary).toContain('Checkpoint Context:')
    expect(checkpoint.summary).toContain('Critical Details To Preserve:')

    const state = await store.loadState(checkpoint.topic)
    const detail = await store.loadDetail(checkpoint.topic)
    expect(state).not.toBeNull()
    expect(detail).not.toBeNull()
    expect(detail!.commands_run).toContain('bun test')
  })

  it('consumes pending checkpoint summaries once with session and global fallback', () => {
    const summaries = new PendingCheckpointSummaries()

    summaries.put('session-a', 'summary-a')
    expect(summaries.consume('session-a')).toBe('summary-a')
    expect(summaries.consume('session-a')).toBeUndefined()

    summaries.put(undefined, 'summary-global')
    expect(summaries.consume('session-b')).toBe('summary-global')
    expect(summaries.consume('session-b')).toBeUndefined()
  })

  it('clears pending checkpoint summary for session key', () => {
    const summaries = new PendingCheckpointSummaries()
    summaries.put('session-clear', 'summary-clear')
    summaries.clear('session-clear')
    expect(summaries.consume('session-clear')).toBeUndefined()
  })

  it('generates checkpoint summary from executed runtime steps', async () => {
    const execution = await runExecutionForCheckpoint(tempDir, {
      objective: 'Implement context checkpoint flow',
      topic: 'runtime checkpoint',
    })

    const store = new CheckpointStore({ rootDir: path.join(tempDir, 'checkpoints') })
    const checkpoint = await createCompactionCheckpoint(execution, store)

    expect(checkpoint.topic).toBe('runtime-checkpoint')
    expect(checkpoint.summary).toContain('Checkpoint Context:')
    expect(checkpoint.summary).toContain('Critical Details To Preserve:')

    const detail = await store.loadDetail(checkpoint.topic)
    expect(detail).not.toBeNull()
    expect(detail!.commands_run).toContain('bun test')
    expect(detail!.decisions).toContain('review_verdict:pass')
  })
})
