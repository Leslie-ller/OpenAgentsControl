import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { createCodingArtifactStore } from '../src/coding/artifact-store.js'

describe('coding artifact store integration', () => {
  let tmpDir: string
  let store: ReturnType<typeof createCodingArtifactStore>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coding-artifact-'))
    store = createCodingArtifactStore(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('persists and retrieves completion summary', async () => {
    const summary = {
      task_id: 'task_001',
      status: 'completed',
      validated: true,
      reviewed: true,
      remaining_risks: [],
      next_actions: [],
    }
    await store.save('completion-summary', 'task_001', 'task_001', summary)
    const loaded = await store.load('completion-summary', 'task_001')
    expect(loaded).not.toBeNull()
    expect(loaded!.data.status).toBe('completed')
  })

  it('lists persisted artifacts by type', async () => {
    await store.save('completion-summary', 'task_001', 'task_001', {
      task_id: 'task_001',
      status: 'completed',
      validated: true,
      reviewed: true,
      remaining_risks: [],
      next_actions: [],
    })
    await store.save('validation-report', 'task_001', 'task_001', {
      task_id: 'task_001',
      commands: ['bun test'],
      results: ['pass'],
      exit_codes: [0],
      failures: [],
      validated_claims: ['acceptance criteria covered'],
    })

    const completion = await store.list('completion-summary')
    const validation = await store.list('validation-report')
    expect(completion).toContain('task_001')
    expect(validation).toContain('task_001')
  })
})
