import { describe, expect, it, beforeEach } from 'bun:test'
import { evaluateModelDrift, hasModelDrift } from '../src/control/model-audit.js'
import { ControlEventFactory } from '../src/control/events.js'
import type { ControlEvent, ModelObservedPayload } from '../src/control/events.js'
import { ControlEventBus } from '../src/control/event-bus.js'
import { evaluateControlFromEvents } from '../src/control/index.js'
import { executeAbility } from '../src/executor/index.js'
import type {
  Ability,
  AgentStep,
  ExecutorContext,
  AgentContext,
  AgentCallReturn,
  AgentCallOptions,
  ModelAuditResult,
} from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function createFactory(runId = 'run_test'): ControlEventFactory {
  return new ControlEventFactory({
    run_id: runId,
    ability_execution_id: 'exec_test',
  })
}

function createMockContext(agentFn?: (opts: AgentCallOptions) => Promise<AgentCallReturn>): ExecutorContext {
  const ctx: ExecutorContext = {
    cwd: process.cwd(),
    env: {},
  }
  if (agentFn) {
    ctx.agents = { call: agentFn }
  }
  return ctx
}

// ─────────────────────────────────────────────────────────────
// hasModelDrift — unit tests
// ─────────────────────────────────────────────────────────────

describe('hasModelDrift', () => {
  it('returns false when both sides are identical', () => {
    expect(
      hasModelDrift(
        { model: 'claude-sonnet-4', provider: 'anthropic' },
        { model: 'claude-sonnet-4', provider: 'anthropic' }
      )
    ).toBe(false)
  })

  it('returns true when model differs', () => {
    expect(
      hasModelDrift(
        { model: 'claude-sonnet-4', provider: 'anthropic' },
        { model: 'gpt-4o', provider: 'anthropic' }
      )
    ).toBe(true)
  })

  it('returns true when provider differs', () => {
    expect(
      hasModelDrift(
        { model: 'claude-sonnet-4', provider: 'anthropic' },
        { model: 'claude-sonnet-4', provider: 'openrouter' }
      )
    ).toBe(true)
  })

  it('returns true when both model and provider differ', () => {
    expect(
      hasModelDrift(
        { model: 'claude-sonnet-4', provider: 'anthropic' },
        { model: 'gpt-4o', provider: 'openai' }
      )
    ).toBe(true)
  })

  it('returns false when expected model is undefined', () => {
    expect(
      hasModelDrift(
        { provider: 'anthropic' },
        { model: 'gpt-4o', provider: 'anthropic' }
      )
    ).toBe(false)
  })

  it('returns false when actual model is undefined', () => {
    expect(
      hasModelDrift(
        { model: 'claude-sonnet-4', provider: 'anthropic' },
        { provider: 'anthropic' }
      )
    ).toBe(false)
  })

  it('returns false when expected provider is undefined', () => {
    expect(
      hasModelDrift(
        { model: 'claude-sonnet-4' },
        { model: 'claude-sonnet-4', provider: 'openai' }
      )
    ).toBe(false)
  })

  it('returns false when actual provider is undefined', () => {
    expect(
      hasModelDrift(
        { model: 'claude-sonnet-4', provider: 'anthropic' },
        { model: 'claude-sonnet-4' }
      )
    ).toBe(false)
  })

  it('returns false when both sides are empty', () => {
    expect(hasModelDrift({}, {})).toBe(false)
  })

  it('returns false when only one side has model (no comparison possible)', () => {
    expect(hasModelDrift({ model: 'claude-sonnet-4' }, {})).toBe(false)
    expect(hasModelDrift({}, { model: 'gpt-4o' })).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// evaluateModelDrift — unit tests
// ─────────────────────────────────────────────────────────────

describe('evaluateModelDrift', () => {
  let factory: ControlEventFactory

  beforeEach(() => {
    factory = createFactory()
  })

  it('returns undefined when no model.observed events exist', () => {
    const events: ControlEvent[] = [
      factory.runStarted('test-ability', {}),
      factory.stepStarted('test-ability', 'step1', 'script'),
      factory.stepCompleted('test-ability', 'step1', 'script', 'completed', 100),
      factory.runCompleted('test-ability', 'completed', 100),
    ]

    expect(evaluateModelDrift(events)).toBeUndefined()
  })

  it('returns zero drifts when model matches expected', () => {
    const events: ControlEvent[] = [
      factory.modelObserved('test-ability', false, 'agent_step_dispatch', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'claude-sonnet-4',
        expected_provider: 'anthropic',
        actual_provider: 'anthropic',
      }),
    ]

    const result = evaluateModelDrift(events)!
    expect(result).toBeDefined()
    expect(result.observed).toBe(1)
    expect(result.driftCount).toBe(0)
    expect(result.drifts).toHaveLength(0)
  })

  it('detects model drift', () => {
    const events: ControlEvent[] = [
      factory.modelObserved('test-ability', true, 'agent_step_dispatch', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'gpt-4o',
        expected_provider: 'anthropic',
        actual_provider: 'anthropic',
      }),
    ]

    const result = evaluateModelDrift(events)!
    expect(result.observed).toBe(1)
    expect(result.driftCount).toBe(1)
    expect(result.drifts).toHaveLength(1)
    expect(result.drifts[0].expectedModel).toBe('claude-sonnet-4')
    expect(result.drifts[0].actualModel).toBe('gpt-4o')
    expect(result.drifts[0].source).toBe('agent_step_dispatch')
  })

  it('detects provider drift', () => {
    const events: ControlEvent[] = [
      factory.modelObserved('test-ability', true, 'agent_step_dispatch', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'claude-sonnet-4',
        expected_provider: 'anthropic',
        actual_provider: 'openrouter',
      }),
    ]

    const result = evaluateModelDrift(events)!
    expect(result.driftCount).toBe(1)
    expect(result.drifts[0].expectedProvider).toBe('anthropic')
    expect(result.drifts[0].actualProvider).toBe('openrouter')
  })

  it('handles multiple observations, some with drift', () => {
    const events: ControlEvent[] = [
      factory.modelObserved('test-ability', false, 'step_1', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'claude-sonnet-4',
        expected_provider: 'anthropic',
        actual_provider: 'anthropic',
      }),
      factory.modelObserved('test-ability', true, 'step_2', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'gpt-4o',
        expected_provider: 'anthropic',
        actual_provider: 'openai',
      }),
      factory.modelObserved('test-ability', false, 'step_3', {
        expected_model: 'gpt-4o',
        actual_model: 'gpt-4o',
      }),
    ]

    const result = evaluateModelDrift(events)!
    expect(result.observed).toBe(3)
    expect(result.driftCount).toBe(1)
    expect(result.drifts).toHaveLength(1)
    expect(result.drifts[0].source).toBe('step_2')
  })

  it('counts multiple drifts across different observations', () => {
    const events: ControlEvent[] = [
      factory.modelObserved('test-ability', true, 'step_1', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'gpt-4o',
      }),
      factory.modelObserved('test-ability', true, 'step_2', {
        expected_provider: 'anthropic',
        actual_provider: 'openrouter',
      }),
    ]

    const result = evaluateModelDrift(events)!
    expect(result.observed).toBe(2)
    expect(result.driftCount).toBe(2)
    expect(result.drifts).toHaveLength(2)
  })

  it('ignores non-model events in the stream', () => {
    const events: ControlEvent[] = [
      factory.runStarted('test-ability', {}),
      factory.stepStarted('test-ability', 's1', 'agent'),
      factory.modelObserved('test-ability', false, 'agent_step_dispatch', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'claude-sonnet-4',
      }),
      factory.stepCompleted('test-ability', 's1', 'agent', 'completed', 200),
      factory.runCompleted('test-ability', 'completed', 200),
    ]

    const result = evaluateModelDrift(events)!
    expect(result.observed).toBe(1)
    expect(result.driftCount).toBe(0)
  })

  it('uses step_id from event context when available', () => {
    // Create a model.observed event that has step_id in context
    const event = factory.create(
      'model.observed',
      { kind: 'system', id: 'model-policy' },
      { ability: 'test', step_id: 'my-agent-step' },
      {
        drift: true,
        source: 'agent_step_dispatch',
        expected_model: 'claude-sonnet-4',
        actual_model: 'gpt-4o',
      } as ModelObservedPayload
    )

    const result = evaluateModelDrift([event])!
    expect(result.drifts[0].stepId).toBe('my-agent-step')
  })

  it('falls back to event id when step_id is not in context', () => {
    // modelObserved factory method does not set step_id in context
    const event = factory.modelObserved('test-ability', true, 'agent_step_dispatch', {
      expected_model: 'claude-sonnet-4',
      actual_model: 'gpt-4o',
    })

    const result = evaluateModelDrift([event])!
    expect(result.drifts[0].stepId).toBe(event.id)
  })
})

// ─────────────────────────────────────────────────────────────
// evaluateControlFromEvents — modelAudit integration
// ─────────────────────────────────────────────────────────────

describe('evaluateControlFromEvents — modelAudit integration', () => {
  let factory: ControlEventFactory

  beforeEach(() => {
    factory = createFactory()
  })

  it('ControlResult includes modelAudit when model.observed events exist', () => {
    const ability: Ability = {
      name: 'audit-test',
      description: 'test ability',
      task_type: 'code_change',
      steps: [],
    }

    const events: ControlEvent[] = [
      factory.runStarted('audit-test', {}),
      factory.stepStarted('audit-test', 's1', 'agent'),
      factory.stepCompleted('audit-test', 's1', 'agent', 'completed', 100, {
        tags: ['test', 'validation'],
      }),
      factory.modelObserved('audit-test', false, 'agent_step_dispatch', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'claude-sonnet-4',
      }),
      factory.runCompleted('audit-test', 'completed', 100),
    ]

    const result = evaluateControlFromEvents(ability, events)!
    expect(result).toBeDefined()
    expect(result.modelAudit).toBeDefined()
    expect(result.modelAudit!.observed).toBe(1)
    expect(result.modelAudit!.driftCount).toBe(0)
  })

  it('ControlResult.modelAudit is undefined when no model observations exist', () => {
    const ability: Ability = {
      name: 'no-audit-test',
      description: 'test ability',
      task_type: 'code_change',
      steps: [],
    }

    const events: ControlEvent[] = [
      factory.runStarted('no-audit-test', {}),
      factory.stepStarted('no-audit-test', 's1', 'script'),
      factory.stepCompleted('no-audit-test', 's1', 'script', 'completed', 100, {
        tags: ['test', 'validation'],
      }),
      factory.runCompleted('no-audit-test', 'completed', 100),
    ]

    const result = evaluateControlFromEvents(ability, events)!
    expect(result.modelAudit).toBeUndefined()
  })

  it('modelAudit records drift without changing gate verdict (audit-only)', () => {
    const ability: Ability = {
      name: 'drift-audit-test',
      description: 'test ability',
      task_type: 'code_change',
      steps: [],
    }

    // Satisfy hard obligations so gate would normally be 'allow' or 'warn'
    const events: ControlEvent[] = [
      factory.runStarted('drift-audit-test', {}),
      factory.stepCompleted('drift-audit-test', 's1', 'agent', 'completed', 100, {
        tags: ['test'],
      }),
      factory.stepCompleted('drift-audit-test', 's2', 'agent', 'completed', 100, {
        tags: ['validation'],
      }),
      factory.stepCompleted('drift-audit-test', 's3', 'agent', 'completed', 100, {
        tags: ['commit'],
      }),
      // Model drifted! But in audit-only mode, this should NOT change gate verdict
      factory.modelObserved('drift-audit-test', true, 'agent_step_dispatch', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'gpt-4o',
        expected_provider: 'anthropic',
        actual_provider: 'openai',
      }),
      factory.runCompleted('drift-audit-test', 'completed', 200),
    ]

    const result = evaluateControlFromEvents(ability, events)!
    expect(result.gate.verdict).toBe('allow')
    expect(result.modelAudit).toBeDefined()
    expect(result.modelAudit!.driftCount).toBe(1)
    expect(result.modelAudit!.drifts[0].expectedModel).toBe('claude-sonnet-4')
    expect(result.modelAudit!.drifts[0].actualModel).toBe('gpt-4o')
  })

  it('returns undefined ControlResult when no task_type', () => {
    const ability: Ability = {
      name: 'no-task-type',
      description: 'test ability',
      steps: [],
    }

    const events: ControlEvent[] = [
      factory.modelObserved('no-task-type', true, 'test', {
        expected_model: 'claude-sonnet-4',
        actual_model: 'gpt-4o',
      }),
    ]

    const result = evaluateControlFromEvents(ability, events)
    expect(result).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// Agent step execution — model audit data capture
// ─────────────────────────────────────────────────────────────

describe('executeAgentStep — model audit data capture', () => {
  it('captures model audit data when agent returns structured result', async () => {
    const ability: Ability = {
      name: 'agent-audit-test',
      description: 'Agent step with model info',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
          model: 'claude-sonnet-4',
          provider: 'anthropic',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => ({
      output: 'Research completed',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
    }))

    const execution = await executeAbility(ability, {}, ctx)
    expect(execution.completedSteps).toHaveLength(1)

    const stepResult = execution.completedSteps[0]
    expect(stepResult.status).toBe('completed')
    expect(stepResult.modelAudit).toBeDefined()
    expect(stepResult.modelAudit!.expectedModel).toBe('claude-sonnet-4')
    expect(stepResult.modelAudit!.expectedProvider).toBe('anthropic')
    expect(stepResult.modelAudit!.actualModel).toBe('claude-sonnet-4')
    expect(stepResult.modelAudit!.actualProvider).toBe('anthropic')
  })

  it('captures model audit data when agent returns plain string', async () => {
    const ability: Ability = {
      name: 'agent-plain-string',
      description: 'Agent step returning plain string',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
          model: 'claude-sonnet-4',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => 'Plain string result')

    const execution = await executeAbility(ability, {}, ctx)
    const stepResult = execution.completedSteps[0]

    expect(stepResult.status).toBe('completed')
    // modelAudit is populated because the step has an expected model
    expect(stepResult.modelAudit).toBeDefined()
    expect(stepResult.modelAudit!.expectedModel).toBe('claude-sonnet-4')
    // No actual model from plain string
    expect(stepResult.modelAudit!.actualModel).toBeUndefined()
  })

  it('no modelAudit when neither step nor result has model info', async () => {
    const ability: Ability = {
      name: 'agent-no-model',
      description: 'Agent step with no model config',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => 'Just a string')

    const execution = await executeAbility(ability, {}, ctx)
    const stepResult = execution.completedSteps[0]

    expect(stepResult.status).toBe('completed')
    expect(stepResult.modelAudit).toBeUndefined()
  })

  it('fails gracefully when no agent context is available', async () => {
    const ability: Ability = {
      name: 'agent-no-context',
      description: 'Agent step without agent context',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
        } as AgentStep,
      ],
    }

    // No agents in context
    const ctx: ExecutorContext = { cwd: process.cwd(), env: {} }

    const execution = await executeAbility(ability, {}, ctx)
    expect(execution.status).toBe('failed')
    expect(execution.completedSteps[0].status).toBe('failed')
    expect(execution.completedSteps[0].error).toContain('Agent execution not available')
  })

  it('handles agent call throwing an error', async () => {
    const ability: Ability = {
      name: 'agent-error',
      description: 'Agent step that throws',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
          model: 'claude-sonnet-4',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => {
      throw new Error('Agent call failed unexpectedly')
    })

    const execution = await executeAbility(ability, {}, ctx)
    expect(execution.status).toBe('failed')
    expect(execution.completedSteps[0].status).toBe('failed')
    expect(execution.completedSteps[0].error).toContain('Agent call failed unexpectedly')
  })

  it('interpolates input variables in agent prompt', async () => {
    let capturedPrompt = ''

    const ability: Ability = {
      name: 'agent-interpolation',
      description: 'Agent step with input interpolation',
      inputs: {
        topic: { type: 'string', required: true },
      },
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Research the topic: {{inputs.topic}}',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async (opts) => {
      capturedPrompt = opts.prompt
      return 'Done'
    })

    await executeAbility(ability, { topic: 'machine learning' }, ctx)
    expect(capturedPrompt).toBe('Research the topic: machine learning')
  })
})

// ─────────────────────────────────────────────────────────────
// model.observed event emission during execution
// ─────────────────────────────────────────────────────────────

describe('model.observed event emission during execution', () => {
  /** Collect all events from a bus via wildcard subscriber */
  function collectEvents(bus: ControlEventBus): ControlEvent[] {
    const collected: ControlEvent[] = []
    bus.onAll((event) => collected.push(event))
    return collected
  }

  it('emits model.observed event for agent step with model audit data', async () => {
    const bus = new ControlEventBus()
    const collected = collectEvents(bus)

    const ability: Ability = {
      name: 'emit-model-test',
      description: 'Agent step emitting model event',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
          model: 'claude-sonnet-4',
          provider: 'anthropic',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => ({
      output: 'Research completed',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
    }))

    await executeAbility(ability, {}, ctx, { eventBus: bus })

    const modelEvents = collected.filter((e) => e.event_type === 'model.observed')

    expect(modelEvents).toHaveLength(1)
    const payload = modelEvents[0].payload as ModelObservedPayload
    expect(payload.drift).toBe(false)
    expect(payload.expected_model).toBe('claude-sonnet-4')
    expect(payload.actual_model).toBe('claude-sonnet-4')
    expect(payload.expected_provider).toBe('anthropic')
    expect(payload.actual_provider).toBe('anthropic')
    expect(payload.source).toBe('agent_step_dispatch')
  })

  it('emits model.observed with drift=true when model differs', async () => {
    const bus = new ControlEventBus()
    const collected = collectEvents(bus)

    const ability: Ability = {
      name: 'drift-emit-test',
      description: 'Agent step with model drift',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
          model: 'claude-sonnet-4',
          provider: 'anthropic',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => ({
      output: 'Research completed',
      model: 'gpt-4o',
      provider: 'openai',
    }))

    await executeAbility(ability, {}, ctx, { eventBus: bus })

    const modelEvents = collected.filter((e) => e.event_type === 'model.observed')

    expect(modelEvents).toHaveLength(1)
    const payload = modelEvents[0].payload as ModelObservedPayload
    expect(payload.drift).toBe(true)
    expect(payload.expected_model).toBe('claude-sonnet-4')
    expect(payload.actual_model).toBe('gpt-4o')
    expect(payload.expected_provider).toBe('anthropic')
    expect(payload.actual_provider).toBe('openai')
  })

  it('does not emit model.observed for script steps', async () => {
    const bus = new ControlEventBus()
    const collected = collectEvents(bus)

    const ability: Ability = {
      name: 'script-no-model',
      description: 'Script step should not emit model event',
      steps: [
        {
          id: 'run-script',
          type: 'script',
          run: 'echo hello',
        },
      ],
    }

    const ctx = createMockContext()
    await executeAbility(ability, {}, ctx, { eventBus: bus })

    const modelEvents = collected.filter((e) => e.event_type === 'model.observed')
    expect(modelEvents).toHaveLength(0)
  })

  it('does not emit model.observed when agent returns plain string and no step model config', async () => {
    const bus = new ControlEventBus()
    const collected = collectEvents(bus)

    const ability: Ability = {
      name: 'agent-plain-no-emit',
      description: 'Agent step with no model config returning plain string',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => 'Plain string')
    await executeAbility(ability, {}, ctx, { eventBus: bus })

    const modelEvents = collected.filter((e) => e.event_type === 'model.observed')
    // No model audit data → no event
    expect(modelEvents).toHaveLength(0)
  })

  it('emits model.observed when step has expected model but agent returns plain string', async () => {
    const bus = new ControlEventBus()
    const collected = collectEvents(bus)

    const ability: Ability = {
      name: 'agent-expected-only',
      description: 'Agent step with expected model but plain string result',
      steps: [
        {
          id: 'ask-agent',
          type: 'agent',
          agent: 'researcher',
          prompt: 'Do research',
          model: 'claude-sonnet-4',
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => 'Plain string')
    await executeAbility(ability, {}, ctx, { eventBus: bus })

    const modelEvents = collected.filter((e) => e.event_type === 'model.observed')
    expect(modelEvents).toHaveLength(1)
    const payload = modelEvents[0].payload as ModelObservedPayload
    expect(payload.expected_model).toBe('claude-sonnet-4')
    expect(payload.actual_model).toBeUndefined()
    // drift=false because actual is undefined (not comparable)
    expect(payload.drift).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// End-to-end: model drift in ControlResult via execution
// ─────────────────────────────────────────────────────────────

describe('end-to-end: model drift audit through execution pipeline', () => {
  it('populates ControlResult.modelAudit after successful execution with agent steps', async () => {
    const bus = new ControlEventBus()

    const ability: Ability = {
      name: 'e2e-audit-test',
      description: 'Full execution with model audit',
      task_type: 'code_change',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'echo tests pass',
          tags: ['test'],
        },
        {
          id: 'validate',
          type: 'script',
          run: 'echo validated',
          tags: ['validation'],
        },
        {
          id: 'agent-review',
          type: 'agent',
          agent: 'reviewer',
          prompt: 'Review the code',
          model: 'claude-sonnet-4',
          provider: 'anthropic',
          tags: ['commit'],
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => ({
      output: 'Code looks good',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
    }))

    const execution = await executeAbility(ability, {}, ctx, { eventBus: bus })

    expect(execution.status).toBe('completed')
    expect(execution.control).toBeDefined()
    expect(execution.control!.gate.verdict).toBe('allow')
    expect(execution.control!.modelAudit).toBeDefined()
    expect(execution.control!.modelAudit!.observed).toBe(1)
    expect(execution.control!.modelAudit!.driftCount).toBe(0)
  })

  it('records drift in ControlResult without blocking (audit-only)', async () => {
    const bus = new ControlEventBus()

    const ability: Ability = {
      name: 'e2e-drift-test',
      description: 'Execution with model drift — should not block',
      task_type: 'code_change',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'echo tests pass',
          tags: ['test'],
        },
        {
          id: 'validate',
          type: 'script',
          run: 'echo validated',
          tags: ['validation'],
        },
        {
          id: 'agent-review',
          type: 'agent',
          agent: 'reviewer',
          prompt: 'Review the code',
          model: 'claude-sonnet-4',
          provider: 'anthropic',
          tags: ['commit'],
        } as AgentStep,
      ],
    }

    const ctx = createMockContext(async () => ({
      output: 'Code looks good',
      model: 'gpt-4o-mini',
      provider: 'openai',
    }))

    const execution = await executeAbility(ability, {}, ctx, { eventBus: bus })

    // Audit-only: drift does NOT change gate verdict
    expect(execution.status).toBe('completed')
    expect(execution.control!.gate.verdict).toBe('allow')

    // But drift IS recorded
    expect(execution.control!.modelAudit).toBeDefined()
    expect(execution.control!.modelAudit!.observed).toBe(1)
    expect(execution.control!.modelAudit!.driftCount).toBe(1)
    expect(execution.control!.modelAudit!.drifts[0].expectedModel).toBe('claude-sonnet-4')
    expect(execution.control!.modelAudit!.drifts[0].actualModel).toBe('gpt-4o-mini')
    expect(execution.control!.modelAudit!.drifts[0].expectedProvider).toBe('anthropic')
    expect(execution.control!.modelAudit!.drifts[0].actualProvider).toBe('openai')
  })

  it('no modelAudit in ControlResult when only script steps are used', async () => {
    const bus = new ControlEventBus()

    const ability: Ability = {
      name: 'e2e-no-agent',
      description: 'No agent steps, no model audit',
      task_type: 'code_change',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'echo tests pass',
          tags: ['test'],
        },
        {
          id: 'validate',
          type: 'script',
          run: 'echo validated',
          tags: ['validation'],
        },
        {
          id: 'commit',
          type: 'script',
          run: 'echo committed',
          tags: ['commit'],
        },
      ],
    }

    const ctx = createMockContext()
    const execution = await executeAbility(ability, {}, ctx, { eventBus: bus })

    expect(execution.status).toBe('completed')
    expect(execution.control!.gate.verdict).toBe('allow')
    expect(execution.control!.modelAudit).toBeUndefined()
  })

  it('no modelAudit in ControlResult when event bus is not provided', async () => {
    // Without event bus, evaluateControl (step-based) is used, which does not have modelAudit
    const ability: Ability = {
      name: 'e2e-no-bus',
      description: 'No event bus, no model audit',
      task_type: 'code_change',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'echo tests pass',
          tags: ['test'],
        },
        {
          id: 'validate',
          type: 'script',
          run: 'echo validated',
          tags: ['validation'],
        },
        {
          id: 'commit',
          type: 'script',
          run: 'echo committed',
          tags: ['commit'],
        },
      ],
    }

    const ctx = createMockContext()
    // No eventBus passed
    const execution = await executeAbility(ability, {}, ctx)

    expect(execution.status).toBe('completed')
    expect(execution.control!.gate.verdict).toBe('allow')
    // Step-based evaluateControl does not produce modelAudit
    expect(execution.control!.modelAudit).toBeUndefined()
  })

  it('handles mixed script and agent steps, only agent steps produce model events', async () => {
    const bus = new ControlEventBus()

    const ability: Ability = {
      name: 'e2e-mixed-steps',
      description: 'Mixed step types',
      task_type: 'code_change',
      steps: [
        {
          id: 'run-tests',
          type: 'script',
          run: 'echo tests pass',
          tags: ['test'],
        },
        {
          id: 'agent-validate',
          type: 'agent',
          agent: 'validator',
          prompt: 'Validate the code',
          model: 'claude-sonnet-4',
          tags: ['validation'],
        } as AgentStep,
        {
          id: 'commit',
          type: 'script',
          run: 'echo committed',
          tags: ['commit'],
        },
      ],
    }

    const ctx = createMockContext(async () => ({
      output: 'Validated',
      model: 'claude-sonnet-4',
    }))

    const execution = await executeAbility(ability, {}, ctx, { eventBus: bus })

    expect(execution.status).toBe('completed')
    expect(execution.control!.modelAudit).toBeDefined()
    expect(execution.control!.modelAudit!.observed).toBe(1)
    expect(execution.control!.modelAudit!.driftCount).toBe(0)
  })
})
