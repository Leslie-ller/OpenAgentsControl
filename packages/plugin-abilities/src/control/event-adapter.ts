import type { ExecutorContext, Step, StepResult, AbilityExecution } from '../types/index.js'
import { ControlEventBus } from './event-bus.js'
import type { TaskType } from './types.js'

/**
 * Creates ExecutorContext lifecycle callbacks that emit structured
 * ControlEvents onto a ControlEventBus in real-time.
 *
 * This replaces the post-hoc `collectExecutionEvents` replay pattern.
 * Both produce the same event shapes so the obligation/gate pipeline
 * works identically regardless of which path generated the events.
 *
 * Usage:
 *   const bus = new ControlEventBus(runId, taskType)
 *   const ctx: ExecutorContext = {
 *     cwd: '...',
 *     env: {},
 *     ...createEventCallbacks(bus),
 *   }
 */
export function createEventCallbacks(
  bus: ControlEventBus,
  options?: { sessionId?: string }
): Pick<
  ExecutorContext,
  'onRunStart' | 'onRunEnd' | 'onStepStart' | 'onStepComplete' | 'onStepFail' | 'onValidation'
> {
  const sessionId = options?.sessionId

  return {
    onRunStart(execution: AbilityExecution) {
      bus.emit(
        'run.started',
        { kind: 'system', id: 'execution-manager' },
        { ability: execution.ability.name },
        {
          ability: execution.ability.name,
          inputKeys: Object.keys(execution.inputs),
        },
        { sessionId }
      )
    },

    onRunEnd(execution: AbilityExecution) {
      const completedAt = execution.completedAt ?? Date.now()
      bus.emit(
        execution.status === 'completed' ? 'run.completed' : 'run.failed',
        { kind: 'system', id: 'execution-manager' },
        { ability: execution.ability.name },
        {
          status: execution.status,
          durationMs: completedAt - execution.startedAt,
          error: execution.error,
        },
        { sessionId }
      )
    },

    onStepStart(step: Step, execution: AbilityExecution) {
      bus.emit(
        'step.started',
        { kind: 'system', id: 'executor' },
        {
          ability: execution.ability.name,
          stepId: step.id,
          stepType: step.type,
          stepTags: step.tags,
        },
        {
          stepId: step.id,
          stepType: step.type,
          stepTags: step.tags,
        },
        { sessionId }
      )
    },

    onStepComplete(step: Step, result: StepResult, execution: AbilityExecution) {
      bus.emit(
        'step.completed',
        { kind: 'system', id: 'executor' },
        {
          ability: execution.ability.name,
          stepId: step.id,
          stepType: step.type,
          stepTags: step.tags,
        },
        {
          stepId: step.id,
          stepType: step.type,
          stepTags: step.tags,
          command: result.command,
          durationMs: result.duration,
        },
        { sessionId }
      )

      if (step.type === 'agent' && result.modelAudit) {
        bus.emit(
          'model.audit',
          { kind: 'system', id: 'executor' },
          {
            ability: execution.ability.name,
            stepId: step.id,
            stepType: step.type,
            stepTags: step.tags,
          },
          {
            agent: step.agent,
            expectedModel: result.modelAudit.expectedModel,
            expectedProvider: result.modelAudit.expectedProvider,
            actualModel: result.modelAudit.actualModel,
            actualProvider: result.modelAudit.actualProvider,
          },
          { sessionId }
        )
      }
    },

    onStepFail(step: Step, error: Error, execution: AbilityExecution) {
      bus.emit(
        'step.failed',
        { kind: 'system', id: 'executor' },
        {
          ability: execution.ability.name,
          stepId: step.id,
          stepType: step.type,
          stepTags: step.tags,
        },
        {
          stepId: step.id,
          stepType: step.type,
          stepTags: step.tags,
          error: error.message,
        },
        { sessionId }
      )
    },

    onValidation(step: Step, result: StepResult, execution: AbilityExecution) {
      if (!result.validation) return
      bus.emit(
        'validation.result',
        { kind: 'system', id: 'executor' },
        {
          ability: execution.ability.name,
          stepId: step.id,
          stepType: step.type,
          stepTags: step.tags,
        },
        {
          validator: 'script.exit_code',
          stepTags: step.tags,
          command: result.command,
          expectedExitCode: result.validation.expectedExitCode,
          actualExitCode: result.validation.actualExitCode,
          passed: result.validation.passed,
        },
        { sessionId }
      )
    },
  }
}
