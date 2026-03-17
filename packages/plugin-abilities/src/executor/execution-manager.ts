import type { Ability, AbilityExecution, ExecutorContext } from '../types/index.js'
import { executeAbility } from './index.js'
import type { ControlEventBus } from '../control/event-bus.js'

/**
 * ExecutionManager
 * 
 * Tracks a single active execution at a time, plus a history of past executions.
 * When an eventBus is provided, all executions emit structured events.
 */
export class ExecutionManager {
  private activeExecution: AbilityExecution | null = null
  private history: AbilityExecution[] = []
  private maxHistory = 50
  private eventBus: ControlEventBus | undefined

  constructor(eventBus?: ControlEventBus) {
    this.eventBus = eventBus
  }

  /**
   * Set or replace the event bus at runtime.
   */
  setEventBus(eventBus: ControlEventBus | undefined): void {
    this.eventBus = eventBus
  }

  async execute(
    ability: Ability,
    inputs: Record<string, unknown>,
    ctx: ExecutorContext
  ): Promise<AbilityExecution> {
    // Block concurrent executions
    if (this.activeExecution && this.activeExecution.status === 'running') {
      throw new Error(`Already executing ability: ${this.activeExecution.ability.name}`)
    }

    console.log(`[abilities] Starting execution: ${ability.name}`)
    
    const execution = await executeAbility(ability, inputs, ctx, {
      eventBus: this.eventBus,
    })
    this.activeExecution = execution

    // Store in history
    this.history.push(execution)

    // Trim history to max size
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(this.history.length - this.maxHistory)
    }

    // Clear active if completed/failed
    if (execution.status !== 'running') {
      this.activeExecution = null
    }

    return execution
  }

  getActive(): AbilityExecution | null {
    return this.activeExecution
  }

  /**
   * Get an execution by ID (from history or active).
   */
  get(executionId: string): AbilityExecution | undefined {
    if (this.activeExecution?.id === executionId) {
      return this.activeExecution
    }
    return this.history.find(e => e.id === executionId)
  }

  /**
   * List all stored executions (history).
   */
  list(): AbilityExecution[] {
    return [...this.history]
  }

  /**
   * Cancel the currently active execution.
   */
  cancelActive(): boolean {
    if (!this.activeExecution) return false
    
    if (this.activeExecution.status === 'running') {
      this.activeExecution.status = 'failed'
      this.activeExecution.error = 'Cancelled by user'
      this.activeExecution.completedAt = Date.now()
      this.activeExecution = null
      return true
    }

    return false
  }

  cancel(executionId?: string): boolean {
    if (executionId) {
      const execution = this.get(executionId)
      if (execution && execution.status === 'running') {
        execution.status = 'failed'
        execution.error = 'Cancelled by user'
        execution.completedAt = Date.now()
        if (this.activeExecution?.id === executionId) {
          this.activeExecution = null
        }
        return true
      }
      return false
    }
    return this.cancelActive()
  }

  cleanup(): void {
    this.activeExecution = null
    this.history = []
  }
}
