/**
 * Control Event Model - v1
 *
 * Unified event types for the control layer.
 * Design principle: events record facts only, never verdicts.
 * Verdicts belong to audit / obligation / gate layers.
 *
 * Reference: "OpenAgentsControl 控制层统一事件模型（v1）" design doc
 */

// ─────────────────────────────────────────────────────────────
// EVENT TYPE ENUM
// ─────────────────────────────────────────────────────────────

export type ControlEventType =
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'tool.called'
  | 'validation.result'
  | 'obligation.signal'
  | 'model.observed'

// ─────────────────────────────────────────────────────────────
// ACTOR
// ─────────────────────────────────────────────────────────────

export type ActorKind = 'agent' | 'user' | 'system' | 'tool' | 'hook'

export interface Actor {
  kind: ActorKind
  id: string
}

// ─────────────────────────────────────────────────────────────
// EVENT CONTEXT
// ─────────────────────────────────────────────────────────────

export interface EventContext {
  ability?: string
  step_id?: string
  step_type?: string
  task_type?: string
  phase?: string
}

// ─────────────────────────────────────────────────────────────
// EVENT PAYLOADS
// ─────────────────────────────────────────────────────────────

export interface RunStartedPayload {
  ability: string
  inputs: Record<string, unknown>
  trigger: string
}

export interface RunCompletedPayload {
  status: 'completed' | 'failed'
  duration_ms: number
  gate_verdict?: string
}

export interface StepStartedPayload {
  step_id: string
  step_type: string
  needs?: string[]
}

export interface StepCompletedPayload {
  step_id: string
  step_type: string
  status: 'completed' | 'failed' | 'skipped'
  duration_ms: number
  tags?: string[]
  output?: string
  error?: string
}

export interface ToolCalledPayload {
  tool: string
  allowed: boolean
  enforcement_mode?: string
  reason?: string
}

export interface ValidationResultPayload {
  validator: string
  expected: unknown
  actual: unknown
  passed: boolean
}

export interface ObligationSignalPayload {
  obligation_key: string
  signal_type: 'step_completed' | 'tool_result' | 'external_confirmation'
  evidence: Record<string, unknown>
}

export interface ModelObservedPayload {
  expected_model?: string
  actual_model?: string
  expected_provider?: string
  actual_provider?: string
  drift: boolean
  source: string
}

export type ControlEventPayload =
  | RunStartedPayload
  | RunCompletedPayload
  | StepStartedPayload
  | StepCompletedPayload
  | ToolCalledPayload
  | ValidationResultPayload
  | ObligationSignalPayload
  | ModelObservedPayload

// ─────────────────────────────────────────────────────────────
// CORE EVENT STRUCTURE
// ─────────────────────────────────────────────────────────────

let eventCounter = 0

export function generateEventId(): string {
  eventCounter++
  return `evt_${Date.now()}_${eventCounter}_${Math.random().toString(36).slice(2, 6)}`
}

export interface ControlEvent<T extends ControlEventPayload = ControlEventPayload> {
  id: string
  ts: string
  source: string
  run_id: string
  session_id?: string
  ability_execution_id?: string
  event_type: ControlEventType
  actor: Actor
  context: EventContext
  payload: T
}

// ─────────────────────────────────────────────────────────────
// EVENT FACTORY
// ─────────────────────────────────────────────────────────────

export interface EventFactoryOptions {
  source?: string
  run_id: string
  session_id?: string
  ability_execution_id?: string
}

/**
 * Creates ControlEvent instances with shared metadata.
 * Reduces boilerplate when emitting multiple events within a single run.
 */
export class ControlEventFactory {
  private options: Required<Pick<EventFactoryOptions, 'source' | 'run_id'>> &
    Pick<EventFactoryOptions, 'session_id' | 'ability_execution_id'>

  constructor(options: EventFactoryOptions) {
    this.options = {
      source: options.source ?? 'openagentscontrol',
      run_id: options.run_id,
      session_id: options.session_id,
      ability_execution_id: options.ability_execution_id,
    }
  }

  create<T extends ControlEventPayload>(
    event_type: ControlEventType,
    actor: Actor,
    context: EventContext,
    payload: T
  ): ControlEvent<T> {
    return {
      id: generateEventId(),
      ts: new Date().toISOString(),
      source: this.options.source,
      run_id: this.options.run_id,
      session_id: this.options.session_id,
      ability_execution_id: this.options.ability_execution_id,
      event_type,
      actor,
      context,
      payload,
    }
  }

  runStarted(ability: string, inputs: Record<string, unknown>, trigger = 'ability.run'): ControlEvent<RunStartedPayload> {
    return this.create('run.started', { kind: 'system', id: 'executor' }, { ability }, {
      ability,
      inputs,
      trigger,
    })
  }

  runCompleted(ability: string, status: 'completed' | 'failed', duration_ms: number, gate_verdict?: string): ControlEvent<RunCompletedPayload> {
    return this.create('run.completed', { kind: 'system', id: 'executor' }, { ability }, {
      status,
      duration_ms,
      gate_verdict,
    })
  }

  runFailed(ability: string, duration_ms: number, error?: string): ControlEvent<RunCompletedPayload> {
    return this.create('run.failed', { kind: 'system', id: 'executor' }, { ability }, {
      status: 'failed',
      duration_ms,
    })
  }

  stepStarted(ability: string, step_id: string, step_type: string, needs?: string[]): ControlEvent<StepStartedPayload> {
    return this.create('step.started', { kind: 'system', id: 'executor' }, { ability, step_id, step_type }, {
      step_id,
      step_type,
      needs,
    })
  }

  stepCompleted(
    ability: string,
    step_id: string,
    step_type: string,
    status: 'completed' | 'failed' | 'skipped',
    duration_ms: number,
    extras?: { tags?: string[]; output?: string; error?: string }
  ): ControlEvent<StepCompletedPayload> {
    return this.create('step.completed', { kind: 'system', id: 'executor' }, { ability, step_id, step_type }, {
      step_id,
      step_type,
      status,
      duration_ms,
      ...extras,
    })
  }

  stepFailed(
    ability: string,
    step_id: string,
    step_type: string,
    duration_ms: number,
    error?: string,
    tags?: string[]
  ): ControlEvent<StepCompletedPayload> {
    return this.create('step.failed', { kind: 'system', id: 'executor' }, { ability, step_id, step_type }, {
      step_id,
      step_type,
      status: 'failed',
      duration_ms,
      error,
      tags,
    })
  }

  toolCalled(
    ability: string,
    tool: string,
    allowed: boolean,
    extras?: { step_id?: string; enforcement_mode?: string; reason?: string }
  ): ControlEvent<ToolCalledPayload> {
    return this.create('tool.called', { kind: 'tool', id: tool }, { ability, step_id: extras?.step_id }, {
      tool,
      allowed,
      enforcement_mode: extras?.enforcement_mode,
      reason: extras?.reason,
    })
  }

  validationResult(
    ability: string,
    step_id: string,
    validator: string,
    expected: unknown,
    actual: unknown,
    passed: boolean
  ): ControlEvent<ValidationResultPayload> {
    return this.create('validation.result', { kind: 'system', id: 'validator' }, { ability, step_id }, {
      validator,
      expected,
      actual,
      passed,
    })
  }

  obligationSignal(
    ability: string,
    obligation_key: string,
    signal_type: ObligationSignalPayload['signal_type'],
    evidence: Record<string, unknown>
  ): ControlEvent<ObligationSignalPayload> {
    return this.create('obligation.signal', { kind: 'system', id: 'obligation-tracker' }, { ability }, {
      obligation_key,
      signal_type,
      evidence,
    })
  }

  modelObserved(
    ability: string,
    drift: boolean,
    source: string,
    extras?: { expected_model?: string; actual_model?: string; expected_provider?: string; actual_provider?: string }
  ): ControlEvent<ModelObservedPayload> {
    return this.create('model.observed', { kind: 'system', id: 'model-policy' }, { ability }, {
      drift,
      source,
      ...extras,
    })
  }
}
