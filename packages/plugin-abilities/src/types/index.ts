/**
 * Abilities System - Shared Type Definitions
 *
 * These types intentionally cover the richer validator/plugin/sdk surface,
 * even though parts of the runtime are still implemented minimally.
 */

// ─────────────────────────────────────────────────────────────
// INPUT TYPES
// ─────────────────────────────────────────────────────────────

export type InputType = 'string' | 'number' | 'boolean' | 'array' | 'object'

export interface InputDefinition {
  type: InputType
  required?: boolean
  default?: unknown
  description?: string
  pattern?: string
  enum?: string[]
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
}

export type InputValues = Record<string, unknown>

// ─────────────────────────────────────────────────────────────
// STEP TYPES
// ─────────────────────────────────────────────────────────────

export interface BaseStep {
  id: string
  description?: string
  tags?: string[]
  needs?: string[]
  when?: string
  timeout?: string
  on_failure?: 'stop' | 'continue' | 'retry' | 'ask'
  max_retries?: number
}

export interface ScriptStep extends BaseStep {
  type: 'script'
  run: string
  cwd?: string
  env?: Record<string, string>
  validation?: {
    exit_code?: number
    stdout_contains?: string
    stderr_contains?: string
    file_exists?: string
  }
}

export interface AgentStep extends BaseStep {
  type: 'agent'
  agent: string
  prompt: string
  model?: string
  provider?: string
  context?: string[]
  summarize?: boolean | string
}

export interface SkillStep extends BaseStep {
  type: 'skill'
  skill: string
  inputs?: Record<string, unknown>
}

export interface ApprovalOption {
  label: string
  value: string
}

export interface ApprovalStep extends BaseStep {
  type: 'approval'
  prompt: string
  options?: ApprovalOption[]
}

export interface WorkflowStep extends BaseStep {
  type: 'workflow'
  workflow: string
  inputs?: Record<string, unknown>
}

export type Step =
  | ScriptStep
  | AgentStep
  | SkillStep
  | ApprovalStep
  | WorkflowStep

export interface Triggers {
  keywords?: string[]
  patterns?: string[]
}

export interface AbilitySettings {
  timeout?: string
  parallel?: boolean
  enforcement?: 'strict' | 'normal' | 'loose'
  approval?: 'plan' | 'checkpoint' | 'none'
  on_failure?: 'stop' | 'continue' | 'retry' | 'ask'
}

export interface AbilityHooks {
  before?: string[]
  after?: string[]
}

// ─────────────────────────────────────────────────────────────
// ABILITY DEFINITION
// ─────────────────────────────────────────────────────────────

export interface Ability {
  name: string
  description: string
  task_type?: import('../control/types.js').TaskType
  version?: string
  triggers?: Triggers
  inputs?: Record<string, InputDefinition>
  steps: Step[]
  settings?: AbilitySettings
  hooks?: AbilityHooks
  compatible_agents?: string[]
  exclusive_agent?: string
  _meta?: {
    filePath: string
    directory: string
    loadedAt?: number
  }
}

// ─────────────────────────────────────────────────────────────
// EXECUTION TYPES
// ─────────────────────────────────────────────────────────────

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type StepStatus = 'completed' | 'failed' | 'skipped'

export interface StepResult {
  stepId: string
  stepType?: Step['type']
  status: StepStatus
  output?: string
  error?: string
  command?: string
  validation?: {
    expectedExitCode?: number
    actualExitCode?: number
    passed: boolean
  }
  modelAudit?: {
    expectedModel?: string
    expectedProvider?: string
    actualModel?: string
    actualProvider?: string
  }
  startedAt: number
  completedAt: number
  duration: number
}

export interface AbilityExecution {
  id: string
  ability: Ability
  inputs: InputValues
  status: ExecutionStatus
  currentStep: Step | null
  currentStepIndex: number
  completedSteps: StepResult[]
  pendingSteps: Step[]
  startedAt: number
  completedAt?: number
  error?: string
}

// ─────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ─────────────────────────────────────────────────────────────

export interface ValidationError {
  path: string
  message: string
  code?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  ability?: Ability
}

// ─────────────────────────────────────────────────────────────
// LOADER TYPES
// ─────────────────────────────────────────────────────────────

export interface LoaderOptions {
  projectDir?: string
  globalDir?: string
  includeGlobal?: boolean
}

export interface LoadedAbility {
  ability: Ability
  filePath: string
  source: 'project' | 'global'
}

// ─────────────────────────────────────────────────────────────
// EXECUTOR CONTEXT
// ─────────────────────────────────────────────────────────────

export interface ExecutorContext {
  cwd: string
  env: Record<string, string>
  agents?: {
    call(options: {
      agent: string
      prompt: string
      model?: string
      provider?: string
    }): Promise<string | {
      output: string
      model?: string
      provider?: string
    }>
    background(options: {
      agent: string
      prompt: string
      model?: string
      provider?: string
    }): Promise<string | {
      output: string
      model?: string
      provider?: string
    }>
  }
  skills?: {
    load(name: string): Promise<string>
  }
  approval?: {
    request(options: { prompt: string; options?: string[] }): Promise<boolean>
  }
  abilities?: {
    get(name: string): Ability | undefined
    execute(ability: Ability, inputs: InputValues): Promise<AbilityExecution>
  }
  onRunStart?: (execution: AbilityExecution) => void
  onRunEnd?: (execution: AbilityExecution) => void
  onStepStart?: (step: Step, execution: AbilityExecution) => void
  onStepComplete?: (step: Step, result: StepResult, execution: AbilityExecution) => void
  onStepFail?: (step: Step, error: Error, execution: AbilityExecution) => void
  onValidation?: (step: Step, result: StepResult, execution: AbilityExecution) => void
  shouldAbort?: (execution: AbilityExecution) => { abort: boolean; reason?: string }
}
