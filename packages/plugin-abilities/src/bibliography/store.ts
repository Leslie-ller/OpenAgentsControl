/**
 * BibliographyStore — File-based artifact persistence for the bibliography pipeline.
 *
 * Directory layout:
 *   <dataDir>/
 *     plan/          — search plans (one per topic)
 *     screening/     — screening-decision artifacts (one per paper)
 *     reading-card/  — reading cards (one per paper)
 *     decision/      — keep/defer/reject decision cards (one per paper)
 *     evidence-pack/ — section-level evidence packs (one per section)
 *     audit/         — citation audit results (one per section)
 *
 * Each artifact is a JSON file named `<key>.json` where key is derived from
 * the primary identifier (paper_key, section slug, topic slug).
 */

import * as fs from 'fs/promises'
import * as path from 'path'

// ─── Artifact types ────────────────────────────────────────

export type ArtifactType =
  | 'plan'
  | 'screening'
  | 'reading-card'
  | 'decision'
  | 'evidence-pack'
  | 'audit'

export interface ArtifactMeta {
  /** Artifact type (subdirectory) */
  type: ArtifactType
  /** Primary key (filename stem) */
  key: string
  /** ISO-8601 creation timestamp */
  createdAt: string
  /** ISO-8601 last-update timestamp */
  updatedAt: string
  /** Ability execution ID that produced this artifact */
  executionId?: string
  /** Source stage that produced it */
  sourceStage?: string
}

export interface Artifact<T = Record<string, unknown>> {
  meta: ArtifactMeta
  data: T
}

// ─── Typed artifact data shapes ────────────────────────────

export interface PlanData {
  topic: string
  queries: string[]
  inclusion_criteria: string[]
  exclusion_criteria: string[]
  target_count: number
}

export interface ScreeningData {
  paper_key: string
  title: string
  decision: 'keep' | 'defer' | 'reject'
  reason: string
  query?: string
}

export interface ReadingCardData {
  paper_key: string
  title: string
  summary: string
  key_findings: string[]
  methodology?: string
  relevance_notes?: string
}

export interface DecisionData {
  paper_key: string
  title: string
  decision: 'keep' | 'defer' | 'reject' | 'revisit'
  rationale: string
  sections_relevant?: string[]
}

export interface EvidencePackData {
  section: string
  selected_paper_keys?: string[]
  papers: Array<{
    paper_key: string
    claim: string
    evidence: string
    strength: 'strong' | 'moderate' | 'weak'
  }>
}

export interface AuditData {
  section: string
  selected_paper_keys?: string[]
  status: 'pass' | 'revise' | 'fail'
  issues: Array<{
    citation: string
    problem: string
    severity: 'error' | 'warning'
  }>
  coverage_score?: number
}

// ─── Store implementation ──────────────────────────────────

export interface BibliographyStoreOptions {
  /** Root data directory. Defaults to `.opencode/bibliography-data` */
  dataDir: string
}

export class BibliographyStore {
  private dataDir: string

  constructor(options: BibliographyStoreOptions) {
    this.dataDir = options.dataDir
  }

  // ── Helpers ──────────────────────────────────────────────

  private dirFor(type: ArtifactType): string {
    return path.join(this.dataDir, type)
  }

  private fileFor(type: ArtifactType, key: string): string {
    const safe = this.sanitizeKey(key)
    return path.join(this.dirFor(type), `${safe}.json`)
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase()
  }

  private async ensureDir(type: ArtifactType): Promise<void> {
    await fs.mkdir(this.dirFor(type), { recursive: true })
  }

  // ── Core CRUD ────────────────────────────────────────────

  /**
   * Save an artifact. Creates or overwrites.
   */
  async save<T extends Record<string, unknown>>(
    type: ArtifactType,
    key: string,
    data: T,
    extra?: Partial<Pick<ArtifactMeta, 'executionId' | 'sourceStage'>>
  ): Promise<Artifact<T>> {
    await this.ensureDir(type)

    const filePath = this.fileFor(type, key)
    const now = new Date().toISOString()

    // Try to preserve createdAt from existing artifact
    let createdAt = now
    try {
      const existing = await this.load<T>(type, key)
      if (existing) createdAt = existing.meta.createdAt
    } catch {
      // New artifact
    }

    const artifact: Artifact<T> = {
      meta: {
        type,
        key,
        createdAt,
        updatedAt: now,
        executionId: extra?.executionId,
        sourceStage: extra?.sourceStage,
      },
      data,
    }

    await fs.writeFile(filePath, JSON.stringify(artifact, null, 2), 'utf-8')
    return artifact
  }

  /**
   * Save one screening artifact per paper_key from a screening batch.
   * Returns all persisted artifacts in input order (entries without paper_key are skipped).
   */
  async saveScreeningBatch(
    screeningItems: Array<Record<string, unknown>>,
    extra?: Partial<Pick<ArtifactMeta, 'executionId' | 'sourceStage'>>
  ): Promise<Array<Artifact<Record<string, unknown>>>> {
    const saved: Array<Artifact<Record<string, unknown>>> = []
    for (const item of screeningItems) {
      const paperKeyRaw = item.paper_key
      if (typeof paperKeyRaw !== 'string' || !paperKeyRaw.trim()) continue
      const paperKey = paperKeyRaw.trim()
      const artifact = await this.save('screening', paperKey, item, extra)
      saved.push(artifact)
    }
    return saved
  }

  /**
   * Load a single artifact by type and key. Returns null if not found.
   */
  async load<T = Record<string, unknown>>(
    type: ArtifactType,
    key: string
  ): Promise<Artifact<T> | null> {
    const filePath = this.fileFor(type, key)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as Artifact<T>
    } catch {
      return null
    }
  }

  /**
   * List all artifact keys for a given type.
   */
  async list(type: ArtifactType): Promise<string[]> {
    const dir = this.dirFor(type)
    try {
      const files = await fs.readdir(dir)
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, ''))
    } catch {
      return []
    }
  }

  /**
   * List all artifacts (with data) for a given type.
   */
  async listAll<T = Record<string, unknown>>(
    type: ArtifactType
  ): Promise<Artifact<T>[]> {
    const keys = await this.list(type)
    const results: Artifact<T>[] = []
    for (const key of keys) {
      const artifact = await this.load<T>(type, key)
      if (artifact) results.push(artifact)
    }
    return results
  }

  /**
   * Delete an artifact. Returns true if deleted, false if not found.
   */
  async delete(type: ArtifactType, key: string): Promise<boolean> {
    const filePath = this.fileFor(type, key)
    try {
      await fs.unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if an artifact exists.
   */
  async exists(type: ArtifactType, key: string): Promise<boolean> {
    const filePath = this.fileFor(type, key)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  // ── Convenience: stage-specific queries ──────────────────

  /**
   * Get all screening decisions with a specific verdict.
   */
  async getScreeningByDecision(
    decision: 'keep' | 'defer' | 'reject'
  ): Promise<Artifact<ScreeningData>[]> {
    const all = await this.listAll<ScreeningData>('screening')
    return all.filter(a => a.data.decision === decision)
  }

  /**
   * Get all decision cards with a specific verdict.
   */
  async getDecisionsByVerdict(
    decision: 'keep' | 'defer' | 'reject' | 'revisit'
  ): Promise<Artifact<DecisionData>[]> {
    const all = await this.listAll<DecisionData>('decision')
    return all.filter(a => a.data.decision === decision)
  }

  /**
   * Get the paper keys that have passed screening (keep) but don't yet have a reading card.
   * This represents the "review queue" — papers ready for full-text review.
   */
  async getReviewQueue(): Promise<string[]> {
    const kept = await this.getScreeningByDecision('keep')
    const keptByCanonical = new Map<string, string>()
    for (const artifact of kept) {
      const paperKey = artifact.data.paper_key
      const canonical = this.sanitizeKey(paperKey)
      if (!keptByCanonical.has(canonical)) {
        keptByCanonical.set(canonical, paperKey)
      }
    }

    const reviewed = await this.list('reading-card')
    return [...keptByCanonical.entries()]
      .filter(([canonicalKey]) => !reviewed.includes(canonicalKey))
      .map(([, originalPaperKey]) => originalPaperKey)
  }

  /**
   * Get paper keys that have reading cards but no decision card yet.
   * This represents the "decision queue".
   */
  async getDecisionQueue(): Promise<string[]> {
    const readingCards = await this.listAll<ReadingCardData>('reading-card')
    const decidedKeys = new Set(await this.list('decision'))
    const queuedByCanonical = new Map<string, string>()

    for (const readingCard of readingCards) {
      const paperKey = readingCard.data.paper_key
      const canonical = this.sanitizeKey(paperKey)
      if (decidedKeys.has(canonical)) continue
      if (!queuedByCanonical.has(canonical)) {
        queuedByCanonical.set(canonical, paperKey)
      }
    }

    return [...queuedByCanonical.values()]
  }

  /**
   * Get a summary of the pipeline state: counts per stage and queue sizes.
   */
  async getPipelineStatus(): Promise<{
    plans: number
    screenings: { total: number; keep: number; defer: number; reject: number }
    readingCards: number
    decisions: { total: number; keep: number; defer: number; reject: number; revisit: number }
    evidencePacks: number
    audits: { total: number; pass: number; revise: number; fail: number }
    queues: { reviewQueue: number; decisionQueue: number }
  }> {
    const [plans, screenings, readingCards, decisions, evidencePacks, audits] = await Promise.all([
      this.list('plan'),
      this.listAll<ScreeningData>('screening'),
      this.list('reading-card'),
      this.listAll<DecisionData>('decision'),
      this.list('evidence-pack'),
      this.listAll<AuditData>('audit'),
    ])

    const reviewQueue = await this.getReviewQueue()
    const decisionQueue = await this.getDecisionQueue()

    return {
      plans: plans.length,
      screenings: {
        total: screenings.length,
        keep: screenings.filter(s => s.data.decision === 'keep').length,
        defer: screenings.filter(s => s.data.decision === 'defer').length,
        reject: screenings.filter(s => s.data.decision === 'reject').length,
      },
      readingCards: readingCards.length,
      decisions: {
        total: decisions.length,
        keep: decisions.filter(d => d.data.decision === 'keep').length,
        defer: decisions.filter(d => d.data.decision === 'defer').length,
        reject: decisions.filter(d => d.data.decision === 'reject').length,
        revisit: decisions.filter(d => d.data.decision === 'revisit').length,
      },
      evidencePacks: evidencePacks.length,
      audits: {
        total: audits.length,
        pass: audits.filter(a => a.data.status === 'pass').length,
        revise: audits.filter(a => a.data.status === 'revise').length,
        fail: audits.filter(a => a.data.status === 'fail').length,
      },
      queues: {
        reviewQueue: reviewQueue.length,
        decisionQueue: decisionQueue.length,
      },
    }
  }

  /**
   * Wipe all artifacts. Primarily for testing.
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.dataDir, { recursive: true, force: true })
    } catch {
      // directory may not exist
    }
  }
}

/**
 * Create a BibliographyStore with the standard data directory.
 */
export function createBibliographyStore(projectDir: string): BibliographyStore {
  return new BibliographyStore({
    dataDir: path.join(projectDir, '.opencode', 'bibliography-data'),
  })
}
