import type { DetailCapsule, DetailUseCase } from './types.js'

function uniq(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))]
}

export function selectDetailFields(capsule: DetailCapsule, useCase: DetailUseCase): Record<string, string[]> {
  switch (useCase) {
    case 'continue_implementation':
      return {
        plan_outline: uniq(capsule.plan_outline),
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
        plan_outline: uniq(capsule.plan_outline),
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

export function renderDetailReinjectionBlock(
  topic: string,
  selected: Record<string, string[]>
): string {
  const lines: string[] = [
    'Detail Reinjection:',
    `topic: ${topic}`,
  ]

  const keys = Object.keys(selected)
  if (keys.length === 0) {
    lines.push('selected_fields: none')
    return lines.join('\n')
  }

  for (const key of keys) {
    lines.push(`${key}:`)
    const values = selected[key]
    if (!Array.isArray(values) || values.length === 0) {
      lines.push('  - none')
      continue
    }
    for (const value of values) {
      lines.push(`  - ${value}`)
    }
  }

  return lines.join('\n')
}
