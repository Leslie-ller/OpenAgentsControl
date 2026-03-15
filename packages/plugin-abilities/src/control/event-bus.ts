import type { ControlEvent, ControlEventType, TaskType } from './types.js'

type EventHandler = (event: ControlEvent) => void

/**
 * Real-time control event bus.
 *
 * Responsibilities:
 * - Accept events as they happen during execution
 * - Notify subscribers synchronously (so obligations can update in-flight)
 * - Accumulate an ordered event log for post-run replay / audit
 *
 * This replaces the "execution finished then replay" pattern for consumers
 * that need in-flight observability (e.g. future mid-run gate checks).
 *
 * The bus is scoped to a single run. Create a new instance per execution.
 */
export class ControlEventBus {
  private handlers: EventHandler[] = []
  private log: ControlEvent[] = []
  private runId: string
  private taskType: TaskType
  private sequence = 0

  constructor(runId: string, taskType: TaskType) {
    this.runId = runId
    this.taskType = taskType
  }

  /** Subscribe to all events. Returns an unsubscribe function. */
  on(handler: EventHandler): () => void {
    this.handlers.push(handler)
    return () => {
      const idx = this.handlers.indexOf(handler)
      if (idx >= 0) this.handlers.splice(idx, 1)
    }
  }

  /** Emit an event. Appends to log and notifies all handlers synchronously. */
  emit(
    eventType: ControlEventType,
    actor: ControlEvent['actor'],
    context: Partial<ControlEvent['context']>,
    payload: Record<string, unknown>,
    options?: { sessionId?: string }
  ): ControlEvent {
    this.sequence += 1
    const event: ControlEvent = {
      id: `${this.runId}_evt_${this.sequence}`,
      ts: new Date().toISOString(),
      source: 'openagentscontrol',
      runId: this.runId,
      sessionId: options?.sessionId,
      eventType,
      actor,
      context: {
        ability: context.ability ?? '',
        stepId: context.stepId,
        stepType: context.stepType,
        taskType: this.taskType,
      },
      payload,
    }

    this.log.push(event)
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (err) {
        console.error('[control] EventBus handler error:', err)
      }
    }
    return event
  }

  /** Get the full ordered event log. */
  getLog(): readonly ControlEvent[] {
    return this.log
  }

  /** Get the run ID this bus is scoped to. */
  getRunId(): string {
    return this.runId
  }

  /** Get the task type. */
  getTaskType(): TaskType {
    return this.taskType
  }
}
