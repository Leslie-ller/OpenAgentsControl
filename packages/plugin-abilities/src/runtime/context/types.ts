export interface StateCapsule {
  topic: string
  current_state: string
  based_on: string[]
  next_action: string
  open_questions: string[]
  key_constraints: string[]
  updated_at: string
}

export interface DetailCapsule {
  topic: string
  critical_details: string[]
  decisions: string[]
  evidence: string[]
  file_refs: string[]
  commands_run: string[]
  unresolved_edges: string[]
  updated_at: string
}

export type DetailUseCase =
  | 'continue_implementation'
  | 'explain_reasoning'
  | 'recover_execution_context'
  | 'resolve_pending_work'
