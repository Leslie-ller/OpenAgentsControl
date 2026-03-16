/**
 * Control Event Log - JSONL Persistence
 *
 * Append-only event log written to disk as JSONL.
 * Each line is a self-contained JSON object representing one ControlEvent.
 *
 * Design principles:
 * - Append-only: never modify or delete existing entries
 * - Crash-safe: each line is flushed individually
 * - Replayable: any run can be reconstructed from the log
 * - Rotatable: each run gets its own log file for easy cleanup
 */

import { mkdir, appendFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import type { ControlEvent } from './events.js'

export interface EventLogOptions {
  /** Base directory for log files. Default: .opencode/control-logs */
  logDir: string
  /** Whether to write per-run files (true) or a single unified log (false). Default: true */
  perRunFiles?: boolean
}

export class EventLog {
  private logDir: string
  private perRunFiles: boolean
  private initialized = false

  constructor(options: EventLogOptions) {
    this.logDir = options.logDir
    this.perRunFiles = options.perRunFiles ?? true
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true })
    }
    this.initialized = true
  }

  private getLogPath(runId: string): string {
    if (this.perRunFiles) {
      return join(this.logDir, `${runId}.jsonl`)
    }
    return join(this.logDir, 'events.jsonl')
  }

  /**
   * Append a single event to the log.
   */
  async append(event: ControlEvent): Promise<void> {
    await this.ensureDir()
    const path = this.getLogPath(event.run_id)
    const line = JSON.stringify(event) + '\n'
    await appendFile(path, line, 'utf-8')
  }

  /**
   * Append multiple events atomically (single write).
   */
  async appendBatch(events: ControlEvent[]): Promise<void> {
    if (events.length === 0) return
    await this.ensureDir()

    // Group by run_id for per-run files
    const grouped = new Map<string, ControlEvent[]>()
    for (const event of events) {
      const key = event.run_id
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(event)
    }

    for (const [runId, runEvents] of grouped) {
      const path = this.getLogPath(runId)
      const lines = runEvents.map((e) => JSON.stringify(e)).join('\n') + '\n'
      await appendFile(path, lines, 'utf-8')
    }
  }

  /**
   * Read all events for a specific run from disk.
   * Returns events in chronological order.
   */
  async readRun(runId: string): Promise<ControlEvent[]> {
    const path = this.getLogPath(runId)
    if (!existsSync(path)) return []

    const content = await readFile(path, 'utf-8')
    const events: ControlEvent[] = []

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event = JSON.parse(trimmed) as ControlEvent
        // For unified log, filter by run_id
        if (!this.perRunFiles && event.run_id !== runId) continue
        events.push(event)
      } catch {
        console.error(`[event-log] Corrupt line in ${path}: ${trimmed.slice(0, 80)}`)
      }
    }

    return events
  }

  /**
   * Check if a log file exists for a given run.
   */
  hasRun(runId: string): boolean {
    return existsSync(this.getLogPath(runId))
  }

  /**
   * Get the log directory path.
   */
  getLogDir(): string {
    return this.logDir
  }
}
