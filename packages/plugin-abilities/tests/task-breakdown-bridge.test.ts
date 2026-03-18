import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { writeTaskBreakdownArtifacts } from '../src/coding/task-breakdown-bridge.js'

describe('task breakdown bridge', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-breakdown-bridge-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('writes task.json and ordered subtask files under .tmp/tasks', async () => {
    const result = await writeTaskBreakdownArtifacts({
      projectDir: tmpDir,
      taskPlan: {
        task_id: 'Task 123 / Login Flow',
        objective: 'Implement login flow with password and oauth',
        context_files: ['.opencode/context/core/standards/code-quality.md'],
        reference_files: ['src/auth/service.ts'],
        acceptance_criteria: ['all tests pass', 'oauth callback works'],
        deliverables: ['implementation', 'validation'],
        complexity: 'complex',
        subtask_count: 2,
      },
      subtasks: [
        {
          subtask_id: 'subtask_1',
          task_id: 'Task 123 / Login Flow',
          title: 'Implement password authentication',
          depends_on: [],
          parallel: true,
          status: 'pending',
          deliverables: ['src/auth/password.ts'],
          acceptance_criteria: ['password login succeeds'],
          agent: 'coder-agent',
        },
        {
          subtask_id: 'subtask_2',
          task_id: 'Task 123 / Login Flow',
          title: 'Implement oauth callback',
          depends_on: ['subtask_1'],
          parallel: false,
          status: 'pending',
          deliverables: ['src/auth/oauth.ts'],
          acceptance_criteria: ['oauth callback succeeds'],
          agent: 'coder-agent',
        },
      ],
    })

    expect(result.featureId).toBe('task-123-login-flow')

    const taskJsonRaw = await fs.readFile(result.taskFile, 'utf-8')
    const taskJson = JSON.parse(taskJsonRaw) as Record<string, unknown>
    expect(taskJson.id).toBe('task-123-login-flow')
    expect(taskJson.subtask_count).toBe(2)

    expect(result.subtaskFiles).toHaveLength(2)
    expect(path.basename(result.subtaskFiles[0])).toBe('subtask_01.json')
    expect(path.basename(result.subtaskFiles[1])).toBe('subtask_02.json')

    const subtask01Raw = await fs.readFile(result.subtaskFiles[0], 'utf-8')
    const subtask01 = JSON.parse(subtask01Raw) as Record<string, unknown>
    expect(subtask01.id).toBe('task-123-login-flow-01')
    expect(subtask01.parallel).toBe(true)
    expect(subtask01.suggested_agent).toBe('coder-agent')

    const subtask02Raw = await fs.readFile(result.subtaskFiles[1], 'utf-8')
    const subtask02 = JSON.parse(subtask02Raw) as Record<string, unknown>
    expect(subtask02.id).toBe('task-123-login-flow-02')
    expect(subtask02.depends_on).toEqual(['subtask_1'])
  })
})
