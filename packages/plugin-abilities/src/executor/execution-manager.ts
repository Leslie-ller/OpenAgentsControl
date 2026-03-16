import type { Ability, AbilityExecution, ExecutorContext } from '../types/index.js'
import { executeAbility } from './index.js'
import type { ControlEventBus } from '../control/event-bus.js'

/**
 * ExecutionManager
 * 
 * Tracks a single active execution at a time.
 * When an eventBus is provided, all executions emit structured events.
 */
export class ExecutionManager {
  private activeExecution: AbilityExecution | null = null
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

    // Clear active if completed/failed
    if (execution.status !== 'running') {
      this.activeExecution = null
    }

    return execution
  }

  getActive(): AbilityExecution | null {
    return this.activeExecution
  }

  cancel(): boolean {
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

  cleanup(): void {
    this.activeExecution = null
  }
}
