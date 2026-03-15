import type { Ability, AbilityExecution, ExecutorContext } from '../types/index.js'
import { executeAbility } from './index.js'

/**
 * Minimal ExecutionManager
 * 
 * Simplified to track SINGLE execution at a time.
 * No session management, no cleanup timers, no multi-execution.
 * 
 * This is the bare minimum to test the core concept.
 */
export class ExecutionManager {
  private activeExecution: AbilityExecution | null = null
  private executions = new Map<string, AbilityExecution>()
  private isExecuting = false
  private readonly maxStoredExecutions = 50

  async execute(
    ability: Ability,
    inputs: Record<string, unknown>,
    ctx: ExecutorContext
  ): Promise<AbilityExecution> {
    // Block concurrent executions
    if (this.isExecuting || (this.activeExecution && this.activeExecution.status === 'running')) {
      const activeName = this.activeExecution?.ability.name ?? ability.name
      throw new Error(`Already executing ability: ${activeName}`)
    }

    console.log(`[abilities] Starting execution: ${ability.name}`)

    this.isExecuting = true

    try {
      const execution = await executeAbility(ability, inputs, ctx)
      this.activeExecution = execution
      this.executions.set(execution.id, execution)
      this.trimStoredExecutions()

      // Clear active if completed/failed
      if (execution.status !== 'running') {
        this.activeExecution = null
      }

      return execution
    } finally {
      this.isExecuting = false
    }
  }

  getActive(): AbilityExecution | null {
    return this.activeExecution
  }

  get(executionId: string): AbilityExecution | null {
    return this.executions.get(executionId) ?? null
  }

  list(): AbilityExecution[] {
    return Array.from(this.executions.values())
  }

  cancel(executionId: string): boolean {
    const execution = this.executions.get(executionId)
    if (!execution) return false

    if (execution.status === 'running') {
      execution.status = 'cancelled'
      execution.error = 'Cancelled by user'
      execution.completedAt = Date.now()
      if (this.activeExecution?.id === executionId) {
        this.activeExecution = null
      }
      return true
    }

    return false
  }

  cancelActive(): boolean {
    if (!this.activeExecution) return false
    return this.cancel(this.activeExecution.id)
  }

  onSessionDeleted(_sessionId: string): void {
    this.cleanup()
  }

  private trimStoredExecutions(): void {
    while (this.executions.size > this.maxStoredExecutions) {
      const oldestKey = this.executions.keys().next().value
      if (!oldestKey) break
      this.executions.delete(oldestKey)
    }
  }

  cleanup(): void {
    this.activeExecution = null
    this.executions.clear()
  }
}
