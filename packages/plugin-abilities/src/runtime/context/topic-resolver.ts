import type { AbilityExecution } from '../../types/index.js'

const OBJECTIVE_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'with',
  'fix',
  'add',
  'update',
  'implement',
  'improve',
  'change',
  'create',
  'build',
  'refactor',
  'make',
])

function sanitizeTopic(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function objectiveTopic(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)

  const meaningful = words.filter((item) => !OBJECTIVE_STOPWORDS.has(item))
  const source = meaningful.length > 0 ? meaningful : words
  const unique = [...new Set(source)]
  const selected = unique.slice(0, 2)
  if (selected.length === 0) return null
  return selected.join('-')
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
    const keyword = objectiveTopic(objective)
    if (keyword) return sanitizeTopic(keyword)
  }

  return sanitizeTopic(execution.ability.name) || 'general'
}
