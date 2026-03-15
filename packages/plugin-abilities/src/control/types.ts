export type ControlEventType =
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'validation.result'
  | 'model.audit'

export interface ControlEvent {
  id: string
  ts: string
  source: 'openagentscontrol'
  runId: string
  sessionId?: string
  eventType: ControlEventType
  actor: {
    kind: 'agent' | 'user' | 'system' | 'tool'
    id: string
  }
  context: {
    ability: string
    stepId?: string
    stepType?: string
    stepTags?: string[]
    taskType?: string
  }
  payload: Record<string, unknown>
}

export type TaskType = 'code_change' | 'research_capture'

export type ObligationKey =
  | 'run_tests'
  | 'record_validation'
  | 'commit_if_required'
  | 'record_source'
  | 'save_summary'
export type ObligationSeverity = 'hard' | 'soft'
export type ObligationStatus =
  | 'expected'
  | 'attempted'
  | 'satisfied'
  | 'failed'
  | 'skipped_with_reason'
  | 'missing'

export interface ObligationState {
  key: ObligationKey
  severity: ObligationSeverity
  status: ObligationStatus
  evidenceEventIds: string[]
  notes: string[]
}

export interface ObligationSnapshot {
  runId: string
  taskType: TaskType
  obligations: ObligationState[]
}

export type GateVerdict = 'allow' | 'warn' | 'block'

export interface GateReason {
  code:
    | 'ALL_HARD_OBLIGATIONS_SATISFIED'
    | 'MISSING_HARD_OBLIGATION'
    | 'FAILED_HARD_OBLIGATION'
    | 'MISSING_SOFT_OBLIGATION'
    | 'FAILED_SOFT_OBLIGATION'
  message: string
}

export interface CompletionGateResult {
  runId: string
  verdict: GateVerdict
  reasons: GateReason[]
  missing: ObligationKey[]
  failed: ObligationKey[]
  warnings: ObligationKey[]
}

export interface MidRunGateState {
  latest: CompletionGateResult | null
  history: CompletionGateResult[]
}

export interface ModelDriftRecord {
  eventId: string
  stepId?: string
  agent?: string
  expectedModel?: string
  expectedProvider?: string
  actualModel?: string
  actualProvider?: string
  drifted: boolean
  reasons: string[]
}

export interface ModelAuditResult {
  runId: string
  observed: number
  driftCount: number
  drifts: ModelDriftRecord[]
}
