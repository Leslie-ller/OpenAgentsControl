import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { CodingArtifactStore } from '../src/coding/artifact-store.js'

describe('CodingArtifactStore', () => {
  let tmpDir: string
  let store: CodingArtifactStore

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coding-artifact-store-'))
    store = new CodingArtifactStore({ dataDir: tmpDir })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('saves and loads task plan artifact', async () => {
    await store.save('task-plan', 'task_001', 'task_001', {
      task_id: 'task_001',
      objective: 'Implement feature',
      context_files: ['a.ts'],
      reference_files: ['b.ts'],
      acceptance_criteria: ['works'],
      deliverables: ['code'],
      complexity: 'small',
      subtask_count: 0,
    })

    const loaded = await store.load('task-plan', 'task_001')
    expect(loaded).not.toBeNull()
    expect(loaded!.meta.type).toBe('task-plan')
    expect(loaded!.data.objective).toBe('Implement feature')
  })

  it('lists and loads all artifacts by type', async () => {
    await store.save('validation-report', 'task_1', 'task_1', {
      task_id: 'task_1',
      commands: ['bun test'],
      results: ['ok'],
      exit_codes: [0],
      failures: [],
      validated_claims: ['tests passed'],
    })
    await store.save('validation-report', 'task_2', 'task_2', {
      task_id: 'task_2',
      commands: ['npm run build'],
      results: ['ok'],
      exit_codes: [0],
      failures: [],
      validated_claims: ['build passed'],
    })

    const keys = await store.list('validation-report')
    expect(keys.length).toBe(2)

    const all = await store.listAll('validation-report')
    expect(all.length).toBe(2)
  })
})
