import * as fs from 'fs/promises'
import * as path from 'path'

export type CodingArtifactType =
  | 'task-plan'
  | 'subtask-record'
  | 'implementation-result'
  | 'validation-report'
  | 'review-report'
  | 'completion-summary'

export interface CodingArtifactMeta {
  type: CodingArtifactType
  task_id: string
  key: string
  createdAt: string
  updatedAt: string
}

export interface CodingArtifact<T extends Record<string, unknown> = Record<string, unknown>> {
  meta: CodingArtifactMeta
  data: T
}

export interface CodingArtifactStoreOptions {
  dataDir: string
}

export interface TaskPlanData {
  task_id: string
  objective: string
  context_files: string[]
  reference_files: string[]
  acceptance_criteria: string[]
  deliverables: string[]
  complexity: 'small' | 'complex'
  subtask_count: number
}

export interface SubtaskRecordData {
  subtask_id: string
  task_id: string
  title: string
  depends_on: string[]
  parallel: boolean
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  deliverables: string[]
  acceptance_criteria: string[]
  agent: string
}

export interface ImplementationResultData {
  task_id: string
  changed_files: string[]
  deliverables_completed: string[]
  acceptance_criteria_status: Array<{ criteria: string; status: 'met' | 'partial' | 'missing' }>
  implementation_summary: string
}

export interface ValidationReportData {
  task_id: string
  commands: string[]
  results: string[]
  exit_codes: number[]
  coverage?: number
  failures: string[]
  validated_claims: string[]
}

export interface ReviewReportData {
  task_id: string
  review_scope: string[]
  blocking_findings: string[]
  non_blocking_findings: string[]
  positive_observations: string[]
  verdict: 'pass' | 'changes_requested'
}

export interface CompletionSummaryData {
  task_id: string
  status: 'completed' | 'partial' | 'blocked'
  validated: boolean
  reviewed: boolean
  remaining_risks: string[]
  next_actions: string[]
}

export class CodingArtifactStore {
  private dataDir: string

  constructor(options: CodingArtifactStoreOptions) {
    this.dataDir = options.dataDir
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase()
  }

  private dirFor(type: CodingArtifactType): string {
    return path.join(this.dataDir, type)
  }

  private fileFor(type: CodingArtifactType, key: string): string {
    return path.join(this.dirFor(type), `${this.sanitizeKey(key)}.json`)
  }

  private async ensureDir(type: CodingArtifactType): Promise<void> {
    await fs.mkdir(this.dirFor(type), { recursive: true })
  }

  async save<T extends Record<string, unknown>>(
    type: CodingArtifactType,
    task_id: string,
    key: string,
    data: T
  ): Promise<CodingArtifact<T>> {
    await this.ensureDir(type)

    const now = new Date().toISOString()
    let createdAt = now
    const existing = await this.load<T>(type, key)
    if (existing) createdAt = existing.meta.createdAt

    const artifact: CodingArtifact<T> = {
      meta: {
        type,
        task_id,
        key,
        createdAt,
        updatedAt: now,
      },
      data,
    }

    await fs.writeFile(this.fileFor(type, key), JSON.stringify(artifact, null, 2), 'utf-8')
    return artifact
  }

  async load<T extends Record<string, unknown>>(
    type: CodingArtifactType,
    key: string
  ): Promise<CodingArtifact<T> | null> {
    try {
      const content = await fs.readFile(this.fileFor(type, key), 'utf-8')
      return JSON.parse(content) as CodingArtifact<T>
    } catch {
      return null
    }
  }

  async list(type: CodingArtifactType): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dirFor(type))
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
    } catch {
      return []
    }
  }

  async listAll<T extends Record<string, unknown>>(type: CodingArtifactType): Promise<Array<CodingArtifact<T>>> {
    const keys = await this.list(type)
    const artifacts: Array<CodingArtifact<T>> = []
    for (const key of keys) {
      const artifact = await this.load<T>(type, key)
      if (artifact) artifacts.push(artifact)
    }
    return artifacts
  }
}

export function createCodingArtifactStore(projectDir: string): CodingArtifactStore {
  return new CodingArtifactStore({
    dataDir: path.join(projectDir, '.opencode', 'coding-data'),
  })
}
