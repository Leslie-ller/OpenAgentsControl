import * as fs from 'fs/promises'
import * as path from 'path'
import type { SubtaskRecordData, TaskPlanData } from './artifact-store.js'

export interface TaskBreakdownBridgeOptions {
  projectDir: string
  taskPlan: TaskPlanData
  subtasks: SubtaskRecordData[]
}

function toFeatureId(taskId: string): string {
  const normalized = taskId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return normalized || 'task'
}

function toSubtaskFileName(index: number): string {
  const seq = String(index + 1).padStart(2, '0')
  return `subtask_${seq}.json`
}

function toSubtaskId(featureId: string, index: number): string {
  const seq = String(index + 1).padStart(2, '0')
  return `${featureId}-${seq}`
}

export async function writeTaskBreakdownArtifacts(options: TaskBreakdownBridgeOptions): Promise<{
  featureId: string
  taskFile: string
  subtaskFiles: string[]
}> {
  const featureId = toFeatureId(options.taskPlan.task_id)
  const taskDir = path.join(options.projectDir, '.tmp', 'tasks', featureId)
  await fs.mkdir(taskDir, { recursive: true })

  const createdAt = new Date().toISOString()
  const taskJson = {
    id: featureId,
    name: options.taskPlan.objective,
    status: 'active',
    objective: options.taskPlan.objective,
    context_files: options.taskPlan.context_files,
    reference_files: options.taskPlan.reference_files,
    exit_criteria: options.taskPlan.acceptance_criteria,
    subtask_count: options.subtasks.length,
    completed_count: options.subtasks.filter((item) => item.status === 'completed').length,
    created_at: createdAt,
  }

  const taskFile = path.join(taskDir, 'task.json')
  await fs.writeFile(taskFile, JSON.stringify(taskJson, null, 2), 'utf-8')

  const subtaskFiles: string[] = []
  for (let index = 0; index < options.subtasks.length; index++) {
    const subtask = options.subtasks[index]
    const seq = String(index + 1).padStart(2, '0')
    const subtaskJson = {
      id: toSubtaskId(featureId, index),
      seq,
      title: subtask.title,
      status: subtask.status,
      depends_on: subtask.depends_on,
      parallel: subtask.parallel,
      suggested_agent: subtask.agent,
      context_files: options.taskPlan.context_files,
      reference_files: options.taskPlan.reference_files,
      acceptance_criteria: subtask.acceptance_criteria,
      deliverables: subtask.deliverables,
    }
    const filePath = path.join(taskDir, toSubtaskFileName(index))
    await fs.writeFile(filePath, JSON.stringify(subtaskJson, null, 2), 'utf-8')
    subtaskFiles.push(filePath)
  }

  return {
    featureId,
    taskFile,
    subtaskFiles,
  }
}
