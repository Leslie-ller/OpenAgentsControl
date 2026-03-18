import type { AbilityExecution } from '../../types/index.js'

function sanitizeTopic(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function firstKeyword(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((item) => item.length >= 3)
  return words[0] ?? null
}

export function resolveTopicFromExecution(execution: AbilityExecution): string {
  const explicit = execution.inputs.topic
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    const normalized = sanitizeTopic(explicit)
    if (normalized.length > 0) return normalized
  }

  if (execution.ability.task_type) {
    const taskTypeTopic = sanitizeTopic(execution.ability.task_type)
    if (taskTypeTopic.length > 0) return taskTypeTopic
  }

  const objective = execution.inputs.objective
  if (typeof objective === 'string') {
    const keyword = firstKeyword(objective)
    if (keyword) return sanitizeTopic(keyword)
  }

  return sanitizeTopic(execution.ability.name) || 'general'
}
