import * as fs from 'fs/promises'
import * as path from 'path'
import type { DetailCapsule, StateCapsule } from './types.js'

export interface CheckpointStoreOptions {
  rootDir: string
}

export class CheckpointStore {
  private rootDir: string

  constructor(options: CheckpointStoreOptions) {
    this.rootDir = options.rootDir
  }

  private sanitizeTopic(topic: string): string {
    return topic
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') || 'general'
  }

  private statePath(topic: string): string {
    return path.join(this.rootDir, 'state', `${this.sanitizeTopic(topic)}.json`)
  }

  private detailPath(topic: string): string {
    return path.join(this.rootDir, 'detail', `${this.sanitizeTopic(topic)}.json`)
  }

  private async ensureParent(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  }

  async saveState(capsule: StateCapsule): Promise<void> {
    const filePath = this.statePath(capsule.topic)
    await this.ensureParent(filePath)
    await fs.writeFile(filePath, JSON.stringify(capsule, null, 2), 'utf-8')
  }

  async saveDetail(capsule: DetailCapsule): Promise<void> {
    const filePath = this.detailPath(capsule.topic)
    await this.ensureParent(filePath)
    await fs.writeFile(filePath, JSON.stringify(capsule, null, 2), 'utf-8')
  }

  async loadState(topic: string): Promise<StateCapsule | null> {
    try {
      const content = await fs.readFile(this.statePath(topic), 'utf-8')
      return JSON.parse(content) as StateCapsule
    } catch {
      return null
    }
  }

  async loadDetail(topic: string): Promise<DetailCapsule | null> {
    try {
      const content = await fs.readFile(this.detailPath(topic), 'utf-8')
      return JSON.parse(content) as DetailCapsule
    } catch {
      return null
    }
  }
}

export function createCheckpointStore(projectDir: string): CheckpointStore {
  return new CheckpointStore({
    rootDir: path.join(projectDir, '.opencode', 'context-checkpoints'),
  })
}
