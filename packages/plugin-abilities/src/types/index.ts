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
  /** Condition expression — step is skipped when it evaluates to false */
  when?: string
  /** Behaviour on step failure: 'stop' (default) or 'continue' */
  on_failure?: 'stop' | 'continue'
  validation?: {
    exit_code?: number
  }
  cwd?: string
  env?: Record<string, string>
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
  /** If true, output is summarized before passing to dependent steps */
  summarize?: boolean
}

export interface SkillStep {
  id: string
  type: 'skill'
  description?: string
  skill: string
  needs?: string[]
  tags?: string[]
}

export interface ApprovalStep {
  id: string
  type: 'approval'
  description?: string
  prompt: string
  needs?: string[]
  tags?: string[]
}

export interface WorkflowStep {
  id: string
  type: 'workflow'
  description?: string
  workflow: string
  inputs?: Record<string, string>
  needs?: string[]
  tags?: string[]
}

export type Step = ScriptStep | AgentStep | SkillStep | ApprovalStep | WorkflowStep

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

export interface SkillContext {
  load(name: string): Promise<string>
}

export interface ApprovalCallOptions {
  prompt: string
  step?: ApprovalStep
}

export interface ApprovalContext {
  request(options?: ApprovalCallOptions): Promise<boolean>
}

export interface AbilitiesContext {
  get(name: string): Ability | undefined
  execute(ability: Ability, inputs: InputValues): Promise<AbilityExecution>
}

export interface ExecutorContext {
  cwd: string
  env: Record<string, string>
  /** Agent execution context. Required for agent steps. */
  agents?: AgentContext
  /** Skill execution context. Required for skill steps. */
  skills?: SkillContext
  /** Approval context. Required for approval steps. */
  approval?: ApprovalContext
  /** Abilities context. Required for workflow (nested) steps. */
  abilities?: AbilitiesContext
  /**
   * Permission validator instance. When provided together with agentPermissions,
   * the executor performs a pre-step permission check and fails steps that are
   * not permitted for the current agent.
   */
  permissionValidator?: PermissionValidatorInterface
  /**
   * Agent permissions for the current execution context.
   * Only effective when permissionValidator is also provided.
   */
  agentPermissions?: AgentPermissionsData
  /**
   * Key-value store for inter-stage artifact passing.
   * Stages can read prior-stage outputs and write their own artifacts.
   * The executor does not interpret these — they are passed through to steps.
   */
  stageOutputs?: Record<string, unknown>
  /** Callback fired when a step starts */
  onStepStart?: (step: Step) => void
  /** Callback fired when a step completes */
  onStepComplete?: (step: Step, result: StepResult) => void
  /** Callback fired when a step fails */
  onStepFail?: (step: Step, error: string) => void
}

/**
 * Minimal interface for the permission validator, matching PermissionValidator.checkStepPermission().
 * Using an interface here avoids a circular dependency between types and validator modules.
 */
export interface PermissionValidatorInterface {
  checkStepPermission(step: Step, agentPermissions?: AgentPermissionsData): { allowed: boolean; reason?: string }
}

/**
 * Minimal agent permissions shape expected by the executor.
 * Compatible with AgentPermissions from context/types.
 */
export interface AgentPermissionsData {
  agent: string
  permissions: Array<{
    skill: string
    tools?: string[]
    resources?: string[]
    description?: string
  }>
}
