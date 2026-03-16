/**
 * Abilities System - Minimal Type Definitions
 * 
 * Stripped down to essentials for testing core concept:
 * - Script steps only
 * - Single execution tracking
 * - No session management
 */

// ─────────────────────────────────────────────────────────────
// INPUT TYPES
// ─────────────────────────────────────────────────────────────

export type InputType = 'string' | 'number' | 'boolean'

export type TaskType =
  | 'code_change'
  | 'paper_screening'
  | 'paper_fulltext_review'
  | 'literature_decision'
  | 'section_evidence_pack'
  | 'citation_audit'

export interface InputDefinition {
  type: InputType
  required?: boolean
  default?: unknown
  description?: string
}

export type InputValues = Record<string, unknown>

// ─────────────────────────────────────────────────────────────
// STEP TYPES (Script only for minimal version)
// ─────────────────────────────────────────────────────────────

export interface ScriptStep {
  id: string
  type: 'script'
  description?: string
  run: string
  needs?: string[]
  tags?: string[]
  validation?: {
    exit_code?: number
  }
}

export type Step = ScriptStep

// ─────────────────────────────────────────────────────────────
// ABILITY DEFINITION
// ─────────────────────────────────────────────────────────────

export interface Ability {
  name: string
  description: string
  task_type?: TaskType
  inputs?: Record<string, InputDefinition>
  steps: Step[]
  _meta?: {
    filePath: string
    directory: string
  }
}

// ─────────────────────────────────────────────────────────────
// EXECUTION TYPES
// ─────────────────────────────────────────────────────────────

export type ExecutionStatus = 'running' | 'completed' | 'failed'
export type StepStatus = 'completed' | 'failed' | 'skipped'

export interface StepResult {
  stepId: string
  status: StepStatus
  tags?: string[]
  output?: string
  error?: string
  startedAt: number
  completedAt: number
  duration: number
}

export type ObligationStatus =
  | 'expected'
  | 'satisfied'
  | 'failed'
  | 'missing'

export type ObligationSeverity = 'hard' | 'soft'

export type ObligationKey =
  | 'run_tests'
  | 'record_validation'
  | 'commit_if_required'
  | 'record_screening_decision'
  | 'extract_fulltext'
  | 'record_reading_card'
  | 'record_decision_card'
  | 'record_evidence_pack'
  | 'record_citation_audit'

export interface ObligationResult {
  key: ObligationKey
  severity: ObligationSeverity
  status: ObligationStatus
  evidenceStepIds: string[]
}

export type GateVerdict = 'allow' | 'warn' | 'block'

export interface GateResult {
  verdict: GateVerdict
  reasons: string[]
  warnings: string[]
}

export interface ControlResult {
  taskType: TaskType
  obligations: ObligationResult[]
  gate: GateResult
}

export interface AbilityExecution {
  id: string
  ability: Ability
  inputs: InputValues
  status: ExecutionStatus
  executionStatus?: ExecutionStatus
  currentStep: Step | null
  currentStepIndex: number
  completedSteps: StepResult[]
  pendingSteps: Step[]
  startedAt: number
  completedAt?: number
  error?: string
  control?: ControlResult
}

// ─────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ─────────────────────────────────────────────────────────────

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ─────────────────────────────────────────────────────────────
// LOADER TYPES
// ─────────────────────────────────────────────────────────────

export interface LoaderOptions {
  projectDir?: string
  includeGlobal?: boolean
}

export interface LoadedAbility {
  ability: Ability
  filePath: string
  source: 'project' | 'global'
}

// ─────────────────────────────────────────────────────────────
// EXECUTOR TYPES
// ─────────────────────────────────────────────────────────────

export interface ExecutorContext {
  cwd: string
  env: Record<string, string>
}
