/**
 * Control Event Bus - Runtime event distribution
 *
 * In-memory event bus that:
 * 1. Distributes events to subscribers in real-time
 * 2. Maintains per-run event history for gate/obligation evaluation
 * 3. Delegates to EventLog for persistence
 *
 * Design: subscribers are synchronous to guarantee ordering.
 * Persistence is fire-and-forget (async but non-blocking).
 */

import type { ControlEvent, ControlEventPayload, ControlEventType } from './events.js'
import type { EventLog } from './event-log.js'

export type EventSubscriber = (event: ControlEvent) => void

export interface EventBusOptions {
  /** Optional persistent log. If provided, all events are also written to disk. */
  log?: EventLog
  /** Max events to keep per run in memory. Default: 500. */
  maxEventsPerRun?: number
}

export class ControlEventBus {
  private subscribers: Map<string, EventSubscriber> = new Map()
  private wildcardSubscribers: Map<string, EventSubscriber> = new Map()
  private runEvents: Map<string, ControlEvent[]> = new Map()
  private log: EventLog | undefined
  private maxEventsPerRun: number

  constructor(options: EventBusOptions = {}) {
    this.log = options.log
    this.maxEventsPerRun = options.maxEventsPerRun ?? 500
  }

  /**
   * Subscribe to specific event types.
   * Returns an unsubscribe function.
   */
  on(eventType: ControlEventType, subscriber: EventSubscriber): () => void {
    const key = `${eventType}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`
    this.subscribers.set(key, (event) => {
      if (event.event_type === eventType) {
        subscriber(event)
      }
    })
    return () => { this.subscribers.delete(key) }
  }

  /**
   * Subscribe to ALL event types.
   * Returns an unsubscribe function.
   */
  onAll(subscriber: EventSubscriber): () => void {
    const key = `*:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`
    this.wildcardSubscribers.set(key, subscriber)
    return () => { this.wildcardSubscribers.delete(key) }
  }

  /**
   * Emit a control event.
   * - Stored in per-run memory
   * - Distributed to matching subscribers
   * - Written to persistent log if configured
   */
  emit(event: ControlEvent): void {
    // Store in per-run history
    const runId = event.run_id
    if (!this.runEvents.has(runId)) {
      this.runEvents.set(runId, [])
    }
    const events = this.runEvents.get(runId)!
    if (events.length < this.maxEventsPerRun) {
      events.push(event)
    }

    // Distribute to typed subscribers
    for (const sub of this.subscribers.values()) {
      try {
        sub(event)
      } catch (err) {
        console.error(`[control-bus] Subscriber error:`, err)
      }
    }

    // Distribute to wildcard subscribers
    for (const sub of this.wildcardSubscribers.values()) {
      try {
        sub(event)
      } catch (err) {
        console.error(`[control-bus] Wildcard subscriber error:`, err)
      }
    }

    // Persist (fire-and-forget)
    if (this.log) {
      this.log.append(event).catch((err) => {
        console.error(`[control-bus] Log write error:`, err)
      })
    }
  }

  /**
   * Get all events for a specific run.
   */
  getRunEvents(runId: string): readonly ControlEvent[] {
    return this.runEvents.get(runId) ?? []
  }

  /**
   * Get events for a run filtered by event type.
   */
  getRunEventsByType(runId: string, eventType: ControlEventType): readonly ControlEvent[] {
    return this.getRunEvents(runId).filter((e) => e.event_type === eventType)
  }

  /**
   * Clear in-memory events for a completed run.
   * Call this after the run summary has been persisted.
   */
  clearRun(runId: string): void {
    this.runEvents.delete(runId)
  }

  /**
   * Clear all state (for testing or session cleanup).
   */
  reset(): void {
    this.subscribers.clear()
    this.wildcardSubscribers.clear()
    this.runEvents.clear()
  }
}
