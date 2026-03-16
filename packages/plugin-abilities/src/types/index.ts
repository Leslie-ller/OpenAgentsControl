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

/**
 * Task type identifier.
 *
 * Built-in task types have predefined obligation templates:
 *   code_change, paper_screening, paper_fulltext_review,
 *   literature_decision, section_evidence_pack, citation_audit
 *
 * Arbitrary strings are allowed — abilities can define custom obligations
 * inline via the `obligations` field in their YAML definition.
 */
export type TaskType = string

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
  /**
   * Inline obligation definitions.
   * When present, these override the built-in defaults for this ability's task_type.
   * This enables custom task types to declare their own obligations
   * without modifying the control layer source code.
   */
  obligations?: ObligationDefinition[]
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

/**
 * Obligation key identifier.
 * Arbitrary strings are allowed — abilities can define custom obligation keys
 * via inline obligation definitions.
 */
export type ObligationKey = string

/**
 * Obligation definition — the template for a single obligation.
 * Can come from built-in defaults or inline in an ability YAML file.
 */
export interface ObligationDefinition {
  key: ObligationKey
  severity: ObligationSeverity
  /** Tags that satisfy this obligation when found on a completed step */
  tags: string[]
  /** Human-readable description (optional, for documentation/tooling) */
  description?: string
}

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
