import type { AbilityExecution } from '../types/index.js'
import type { ControlEvent, TaskType } from './types.js'

function createEventId(runId: string, sequence: number): string {
  return `${runId}_evt_${sequence}`
}

function toIso(ts: number): string {
  return new Date(ts).toISOString()
}

export function collectExecutionEvents(
  execution: AbilityExecution,
  taskType: TaskType,
  sessionId?: string
): ControlEvent[] {
  const events: ControlEvent[] = []
  let sequence = 0
  const nextId = () => {
    sequence += 1
    return createEventId(execution.id, sequence)
  }
  const baseContext = {
    ability: execution.ability.name,
    taskType,
  }

  events.push({
    id: nextId(),
    ts: toIso(execution.startedAt),
    source: 'openagentscontrol',
    runId: execution.id,
    sessionId,
    eventType: 'run.started',
    actor: { kind: 'system', id: 'execution-manager' },
    context: baseContext,
    payload: {
      ability: execution.ability.name,
      inputKeys: Object.keys(execution.inputs),
    },
  })

  const stepsById = new Map(execution.ability.steps.map((step) => [step.id, step]))

  for (const step of execution.completedSteps) {
    const stepDefinition = stepsById.get(step.stepId)
    const stepContext = {
      ...baseContext,
      stepId: step.stepId,
      stepType: step.stepType,
      stepTags: stepDefinition?.tags,
    }

    events.push({
      id: nextId(),
      ts: toIso(step.startedAt),
      source: 'openagentscontrol',
      runId: execution.id,
      sessionId,
      eventType: 'step.started',
      actor: { kind: 'system', id: 'executor' },
      context: stepContext,
      payload: {
        stepId: step.stepId,
        stepType: step.stepType,
        stepTags: stepDefinition?.tags,
        command: step.command,
      },
    })

    if (step.validation) {
      events.push({
        id: nextId(),
        ts: toIso(step.completedAt),
        source: 'openagentscontrol',
        runId: execution.id,
        sessionId,
        eventType: 'validation.result',
        actor: { kind: 'system', id: 'executor' },
        context: stepContext,
        payload: {
          validator: 'script.exit_code',
          stepTags: stepDefinition?.tags,
          command: step.command,
          expectedExitCode: step.validation.expectedExitCode,
          actualExitCode: step.validation.actualExitCode,
          passed: step.validation.passed,
        },
      })
    }

    events.push({
      id: nextId(),
      ts: toIso(step.completedAt),
      source: 'openagentscontrol',
      runId: execution.id,
      sessionId,
      eventType: step.status === 'failed' ? 'step.failed' : 'step.completed',
      actor: { kind: 'system', id: 'executor' },
      context: stepContext,
      payload: {
        stepId: step.stepId,
        stepType: step.stepType,
        stepTags: stepDefinition?.tags,
        command: step.command,
        durationMs: step.duration,
        error: step.error,
      },
    })

    if (step.stepType === 'agent' && step.modelAudit) {
      events.push({
        id: nextId(),
        ts: toIso(step.completedAt),
        source: 'openagentscontrol',
        runId: execution.id,
        sessionId,
        eventType: 'model.audit',
        actor: { kind: 'system', id: 'executor' },
        context: stepContext,
        payload: {
          agent: stepDefinition?.type === 'agent' ? stepDefinition.agent : undefined,
          expectedModel: step.modelAudit.expectedModel,
          expectedProvider: step.modelAudit.expectedProvider,
          actualModel: step.modelAudit.actualModel,
          actualProvider: step.modelAudit.actualProvider,
        },
      })
    }
  }

  const completedAt = execution.completedAt ?? Date.now()
  events.push({
    id: nextId(),
    ts: toIso(completedAt),
    source: 'openagentscontrol',
    runId: execution.id,
    sessionId,
    eventType: execution.status === 'completed' ? 'run.completed' : 'run.failed',
    actor: { kind: 'system', id: 'execution-manager' },
    context: baseContext,
    payload: {
      status: execution.status,
      durationMs: completedAt - execution.startedAt,
      error: execution.error,
    },
  })

  return events
}
