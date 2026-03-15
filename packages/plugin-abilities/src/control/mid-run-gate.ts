import { evaluateCompletionGate } from './gates.js'
import { evaluateObligations } from './obligations.js'
import type { ControlEventBus } from './event-bus.js'
import type { CompletionGateResult, ControlEvent, MidRunGateState, TaskType } from './types.js'

function isGateRelevantEvent(event: ControlEvent): boolean {
  return (
    event.eventType === 'step.completed' ||
    event.eventType === 'step.failed' ||
    event.eventType === 'validation.result' ||
    event.eventType === 'run.completed' ||
    event.eventType === 'run.failed'
  )
}

function areEqual(a: CompletionGateResult | null, b: CompletionGateResult): boolean {
  if (!a) return false

  return (
    a.verdict === b.verdict &&
    JSON.stringify(a.missing) === JSON.stringify(b.missing) &&
    JSON.stringify(a.failed) === JSON.stringify(b.failed) &&
    JSON.stringify(a.warnings) === JSON.stringify(b.warnings) &&
    JSON.stringify(a.reasons) === JSON.stringify(b.reasons)
  )
}

export class MidRunGateMonitor {
  private latest: CompletionGateResult | null = null
  private history: CompletionGateResult[] = []
  private unsubscribe: (() => void) | null = null
  private readonly taskType: TaskType

  constructor(bus: ControlEventBus, taskType?: TaskType) {
    this.taskType = taskType ?? bus.getTaskType()
    this.unsubscribe = bus.on((event) => {
      if (!isGateRelevantEvent(event)) return

      const snapshot = evaluateObligations(bus.getLog(), this.taskType)
      const next = evaluateCompletionGate(snapshot)

      if (!areEqual(this.latest, next)) {
        this.latest = next
        this.history.push(next)
      }
    })
  }

  getLatest(): CompletionGateResult | null {
    return this.latest
  }

  getHistory(): CompletionGateResult[] {
    return [...this.history]
  }

  getState(): MidRunGateState {
    return {
      latest: this.latest,
      history: this.getHistory(),
    }
  }

  cleanup(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }
}
