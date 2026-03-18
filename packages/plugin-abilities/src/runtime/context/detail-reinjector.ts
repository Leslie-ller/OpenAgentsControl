import type { DetailCapsule, DetailUseCase } from './types.js'

function uniq(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))]
}

export function selectDetailFields(capsule: DetailCapsule, useCase: DetailUseCase): Record<string, string[]> {
  switch (useCase) {
    case 'continue_implementation':
      return {
        critical_details: uniq(capsule.critical_details),
        decisions: uniq(capsule.decisions),
      }
    case 'explain_reasoning':
      return {
        decisions: uniq(capsule.decisions),
        evidence: uniq(capsule.evidence),
      }
    case 'recover_execution_context':
      return {
        file_refs: uniq(capsule.file_refs),
        commands_run: uniq(capsule.commands_run),
      }
    case 'resolve_pending_work':
      return {
        unresolved_edges: uniq(capsule.unresolved_edges),
      }
    default:
      return {}
  }
}
