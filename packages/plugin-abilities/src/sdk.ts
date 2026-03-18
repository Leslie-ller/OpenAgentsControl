import type { Ability, AbilityExecution, ControlResult, ExecutorContext, LoadedAbility, InputValues } from './types/index.js'
import { loadAbilities, listAbilities } from './loader/index.js'
import { validateAbility, validateInputs } from './validator/index.js'
import { executeAbility, formatExecutionResult } from './executor/index.js'
import { ExecutionManager } from './executor/execution-manager.js'
import { deriveCompletionSummary } from './coding/completion-summary.js'
import { createBibliographyStore } from './bibliography/store.js'
import { BibliographyPipeline } from './bibliography/pipeline.js'
import { parseCommandInput, routeBibliographyCommand } from './bibliography/command-routing.js'
import { scanBibliographyArtifacts, type AuditScanResult } from './bibliography/audit-scan.js'
import * as path from 'path'

export interface AbilitiesSDKOptions {
  projectDir?: string
  globalDir?: string
  includeGlobal?: boolean
}

export interface AbilityInfo {
  name: string
  description: string
  source: 'project' | 'global'
  triggers?: string[]
  inputCount: number
  stepCount: number
}

export interface ExecutionResult {
  id: string
  status: 'completed' | 'failed' | 'cancelled'
  ability: string
  duration: number
  steps: Array<{
    id: string
    status: string
    duration?: number
    output?: string
    error?: string
  }>
  error?: string
  completion?: {
    task_id: string
    status: 'completed' | 'partial' | 'blocked'
    validated: boolean
    reviewed: boolean
    remaining_risks: string[]
    next_actions: string[]
  }
  formatted: string
}

export interface CommandExecutionResult {
  command: string
  stage?: string
  routedAbility?: string
  inputs?: Record<string, unknown>
  result?: ExecutionResult
  execution?: {
    id: string
    status: 'running' | 'completed' | 'failed' | 'cancelled'
    control?: ControlResult
  }
  artifact?: {
    key: string
    batchKey?: string
    meta: unknown
    data: unknown
    artifacts: Array<{
      key: string
      meta: unknown
      data: unknown
    }>
  }
  error?: string
}

function deriveProjectRoot(projectDir?: string): string {
  if (!projectDir) return process.cwd()
  const normalized = projectDir.split(path.sep).join('/')
  if (normalized.endsWith('/.opencode/abilities')) {
    return path.resolve(projectDir, '..', '..')
  }
  return projectDir
}

export class AbilitiesSDK {
  private abilities: Map<string, LoadedAbility> = new Map()
  private executionManager: ExecutionManager
  private initialized = false
  private options: AbilitiesSDKOptions
  private bibliographyPipeline: BibliographyPipeline

  constructor(options: AbilitiesSDKOptions = {}) {
    this.options = options
    this.executionManager = new ExecutionManager()
    const dataRoot = deriveProjectRoot(this.options.projectDir)
    this.bibliographyPipeline = new BibliographyPipeline(createBibliographyStore(dataRoot))
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const loaded = await loadAbilities({
      projectDir: this.options.projectDir,
      globalDir: this.options.globalDir,
      includeGlobal: this.options.includeGlobal ?? true,
    })

    for (const [name, ability] of loaded) {
      this.abilities.set(name, ability)
    }

    this.initialized = true
  }

  async list(): Promise<AbilityInfo[]> {
    await this.initialize()

    return listAbilities(this.abilities).map(item => ({
      name: item.name,
      description: item.description,
      source: item.source,
      triggers: item.triggers,
      inputCount: item.inputCount,
      stepCount: item.stepCount,
    }))
  }

  async get(name: string): Promise<Ability | undefined> {
    await this.initialize()
    return this.abilities.get(name)?.ability
  }

  async validate(name: string): Promise<{ valid: boolean; errors: string[] }> {
    await this.initialize()

    const loaded = this.abilities.get(name)
    if (!loaded) {
      return { valid: false, errors: [`Ability '${name}' not found`] }
    }

    const result = validateAbility(loaded.ability)
    return {
      valid: result.valid,
      errors: result.errors.map(e => `${e.path}: ${e.message}`),
    }
  }

  async execute(
    name: string,
    inputs: InputValues = {},
    context?: Partial<ExecutorContext>
  ): Promise<ExecutionResult> {
    await this.initialize()

    const loaded = this.abilities.get(name)
    if (!loaded) {
      return {
        id: '',
        status: 'failed',
        ability: name,
        duration: 0,
        steps: [],
        error: `Ability '${name}' not found`,
        formatted: `Error: Ability '${name}' not found`,
      }
    }

    const ability = loaded.ability

    const inputErrors = validateInputs(ability, inputs)
    if (inputErrors.length > 0) {
      return {
        id: '',
        status: 'failed',
        ability: name,
        duration: 0,
        steps: [],
        error: `Input validation failed: ${inputErrors.map(e => e.message).join(', ')}`,
        formatted: `Input validation failed:\n${inputErrors.map(e => `- ${e.message}`).join('\n')}`,
      }
    }

    const self = this
    const executorContext: ExecutorContext = {
      cwd: context?.cwd || process.cwd(),
      env: context?.env || {},
      agents: context?.agents,
      skills: context?.skills,
      approval: context?.approval,
      abilities: {
        get: (n: string) => self.abilities.get(n)?.ability,
        execute: async (a: Ability, i: InputValues) => {
          return executeAbility(a, i, executorContext)
        },
      },
      onStepStart: context?.onStepStart,
      onStepComplete: context?.onStepComplete,
      onStepFail: context?.onStepFail,
    }

    try {
      const execution = await this.executionManager.execute(ability, inputs, executorContext)

      return {
        id: execution.id,
        status: execution.status === 'completed' ? 'completed' : execution.status === 'cancelled' ? 'cancelled' : 'failed',
        ability: ability.name,
        duration: execution.completedAt ? execution.completedAt - execution.startedAt : 0,
        steps: execution.completedSteps.map(s => ({
          id: s.stepId,
          status: s.status,
          duration: s.duration,
          output: s.output,
          error: s.error,
        })),
        error: execution.error,
        completion: deriveCompletionSummary(execution) ?? undefined,
        formatted: formatExecutionResult(execution),
      }
    } catch (error) {
      return {
        id: '',
        status: 'failed',
        ability: name,
        duration: 0,
        steps: [],
        error: error instanceof Error ? error.message : String(error),
        formatted: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async executeCommand(command: string, rawArguments = ''): Promise<CommandExecutionResult> {
    const args = parseCommandInput(rawArguments)
    const routed = routeBibliographyCommand(command, args)
    if (!routed) {
      return { command, error: `No runtime ability mapping for command '${command}'` }
    }

    await this.initialize()
    const loaded = this.abilities.get(routed.abilityName)
    if (!loaded) {
      return {
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        inputs: routed.inputs,
        error: `Ability '${routed.abilityName}' not found`,
      }
    }

    const inputErrors = validateInputs(loaded.ability, routed.inputs)
    if (inputErrors.length > 0) {
      return {
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        inputs: routed.inputs,
        error: `Input validation failed: ${inputErrors.map((e) => e.message).join(', ')}`,
      }
    }

    try {
      const stageResult = await this.bibliographyPipeline.runStageCommand(
        routed.stage,
        loaded.ability,
        routed.inputs,
        {
          cwd: this.options.projectDir ?? process.cwd(),
          env: {},
        }
      )

      return {
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        inputs: routed.inputs,
        execution: stageResult.execution,
        artifact: stageResult.artifact,
      }
    } catch (error) {
      return {
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        inputs: routed.inputs,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async status(executionId?: string): Promise<{
    active: boolean
    ability?: string
    currentStep?: string
    progress?: string
    status?: string
  }> {
    const execution = executionId
      ? this.executionManager.get(executionId)
      : this.executionManager.getActive()

    if (!execution) {
      return { active: false }
    }

    return {
      active: execution.status === 'running',
      ability: execution.ability.name,
      currentStep: execution.currentStep?.id,
      progress: `${execution.completedSteps.length}/${execution.ability.steps.length}`,
      status: execution.status,
    }
  }

  async scanBibliography(): Promise<AuditScanResult> {
    return scanBibliographyArtifacts(this.bibliographyPipeline.getStore())
  }

  async cancel(executionId?: string): Promise<boolean> {
    if (executionId) {
      return this.executionManager.cancel(executionId)
    }
    return this.executionManager.cancelActive()
  }

  async waitFor(executionId: string, timeoutMs: number = 300000): Promise<ExecutionResult | null> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const execution = this.executionManager.get(executionId)

      if (!execution) {
        return null
      }

      if (execution.status !== 'running') {
        return {
          id: execution.id,
          status: execution.status === 'completed' ? 'completed' : execution.status === 'cancelled' ? 'cancelled' : 'failed',
          ability: execution.ability.name,
          duration: execution.completedAt ? execution.completedAt - execution.startedAt : 0,
          steps: execution.completedSteps.map(s => ({
            id: s.stepId,
            status: s.status,
            duration: s.duration,
            output: s.output,
            error: s.error,
          })),
          error: execution.error,
          completion: deriveCompletionSummary(execution) ?? undefined,
          formatted: formatExecutionResult(execution),
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return null
  }

  cleanup(): void {
    this.executionManager.cleanup()
    this.abilities.clear()
    this.initialized = false
  }
}

export function createAbilitiesSDK(options?: AbilitiesSDKOptions): AbilitiesSDK {
  return new AbilitiesSDK(options)
}

export { loadAbilities, listAbilities, validateAbility, validateInputs, executeAbility, formatExecutionResult }
export type { Ability, AbilityExecution, ExecutorContext, LoadedAbility, InputValues }
