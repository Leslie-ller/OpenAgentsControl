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

export interface AgentStep {
  id: string
  type: 'agent'
  description?: string
  agent: string
  prompt: string
  needs?: string[]
  tags?: string[]
  /** Expected model for drift audit (e.g. 'claude-sonnet-4') */
  model?: string
  /** Expected provider for drift audit (e.g. 'anthropic') */
  provider?: string
}

export type Step = ScriptStep | AgentStep

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
  /** Model audit data, populated for agent steps when model info is available */
  modelAudit?: {
    expectedModel?: string
    expectedProvider?: string
    actualModel?: string
    actualProvider?: string
  }
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

// ─────────────────────────────────────────────────────────────
// MODEL DRIFT AUDIT TYPES
// ─────────────────────────────────────────────────────────────

export type DriftPolicy = 'audit-only' | 'soft-pin' | 'hard-pin'

export interface ModelDriftEntry {
  stepId: string
  expectedModel?: string
  actualModel?: string
  expectedProvider?: string
  actualProvider?: string
  source: string
}

export interface ModelAuditResult {
  /** Total model.observed events in this run */
  observed: number
  /** Number of observations where drift was detected */
  driftCount: number
  /** Individual drift records */
  drifts: ModelDriftEntry[]
}

export interface ControlResult {
  taskType: TaskType
  obligations: ObligationResult[]
  gate: GateResult
  /** Model drift audit summary (v1.8). Audit-only: does not affect gate verdict. */
  modelAudit?: ModelAuditResult
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

export interface AgentCallOptions {
  agent: string
  prompt: string
  step?: AgentStep
}

/** Result from an agent call — plain string or structured with model info */
export type AgentCallReturn = string | { output: string; model?: string; provider?: string }

export interface AgentContext {
  call(options: AgentCallOptions): Promise<AgentCallReturn>
  background?(options: AgentCallOptions): Promise<AgentCallReturn>
}

export interface ExecutorContext {
  cwd: string
  env: Record<string, string>
  /** Agent execution context. Required for agent steps. */
  agents?: AgentContext
}
