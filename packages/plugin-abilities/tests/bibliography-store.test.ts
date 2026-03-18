import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { BibliographyStore } from '../src/bibliography/store.js'
import type {
  ScreeningData,
  ReadingCardData,
  DecisionData,
  EvidencePackData,
  AuditData,
  PlanData,
} from '../src/bibliography/store.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('BibliographyStore', () => {
  let store: BibliographyStore
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bibstore-test-'))
    store = new BibliographyStore({ dataDir: tmpDir })
  })

  afterEach(async () => {
    await store.clear()
    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
  })

  // ── Basic CRUD ────────────────────────────────────────────

  describe('save and load', () => {
    it('saves and loads a plan artifact', async () => {
      const data: PlanData = {
        topic: 'agent safety',
        queries: ['agent safety', 'agent safety systematic review'],
        inclusion_criteria: ['peer-reviewed', '2020-2026'],
        exclusion_criteria: ['pre-2015'],
        target_count: 20,
      }
      const artifact = await store.save('plan', 'agent-safety', data)

      expect(artifact.meta.type).toBe('plan')
      expect(artifact.meta.key).toBe('agent-safety')
      expect(artifact.data.topic).toBe('agent safety')

      const loaded = await store.load<PlanData>('plan', 'agent-safety')
      expect(loaded).not.toBeNull()
      expect(loaded!.data.queries).toEqual(['agent safety', 'agent safety systematic review'])
    })

    it('saves and loads a screening artifact', async () => {
      const data: ScreeningData = {
        paper_key: 'arxiv_2024_001',
        title: 'LLM Safety in Agentic Systems',
        decision: 'keep',
        reason: 'Directly relevant to thesis chapter 3',
      }
      await store.save('screening', 'arxiv_2024_001', data)

      const loaded = await store.load<ScreeningData>('screening', 'arxiv_2024_001')
      expect(loaded!.data.decision).toBe('keep')
      expect(loaded!.data.title).toBe('LLM Safety in Agentic Systems')
    })

    it('preserves createdAt on update', async () => {
      await store.save('plan', 'test', { topic: 'v1' } as PlanData)
      const first = await store.load<PlanData>('plan', 'test')

      // Small delay to ensure timestamps differ
      await new Promise(r => setTimeout(r, 10))

      await store.save('plan', 'test', { topic: 'v2' } as PlanData)
      const second = await store.load<PlanData>('plan', 'test')

      expect(second!.data.topic).toBe('v2')
      expect(second!.meta.createdAt).toBe(first!.meta.createdAt)
      expect(second!.meta.updatedAt).not.toBe(first!.meta.updatedAt)
    })

    it('returns null for non-existent artifact', async () => {
      const result = await store.load('plan', 'nonexistent')
      expect(result).toBeNull()
    })

    it('sanitizes keys for safe filenames', async () => {
      await store.save('plan', 'My Topic: Agent Safety!', { topic: 'test' } as PlanData)
      const loaded = await store.load<PlanData>('plan', 'My Topic: Agent Safety!')
      expect(loaded).not.toBeNull()
      expect(loaded!.data.topic).toBe('test')
    })

    it('stores execution metadata', async () => {
      await store.save('screening', 'p1', { paper_key: 'p1' } as ScreeningData, {
        executionId: 'exec_123',
        sourceStage: 'screening',
      })

      const loaded = await store.load('screening', 'p1')
      expect(loaded!.meta.executionId).toBe('exec_123')
      expect(loaded!.meta.sourceStage).toBe('screening')
    })
  })

  // ── List / exists / delete ────────────────────────────────

  describe('list, exists, delete', () => {
    it('lists artifact keys for a type', async () => {
      await store.save('screening', 'paper-a', { paper_key: 'a' } as ScreeningData)
      await store.save('screening', 'paper-b', { paper_key: 'b' } as ScreeningData)
      await store.save('reading-card', 'paper-a', { paper_key: 'a' } as ReadingCardData)

      const screeningKeys = await store.list('screening')
      expect(screeningKeys.length).toBe(2)
      expect(screeningKeys).toContain('paper-a')
      expect(screeningKeys).toContain('paper-b')

      const readingKeys = await store.list('reading-card')
      expect(readingKeys.length).toBe(1)
    })

    it('returns empty list for empty type', async () => {
      const keys = await store.list('audit')
      expect(keys).toEqual([])
    })

    it('checks if artifact exists', async () => {
      await store.save('plan', 'topic1', { topic: 'test' } as PlanData)
      expect(await store.exists('plan', 'topic1')).toBe(true)
      expect(await store.exists('plan', 'topic2')).toBe(false)
    })

    it('deletes an artifact', async () => {
      await store.save('plan', 'topic1', { topic: 'test' } as PlanData)
      expect(await store.delete('plan', 'topic1')).toBe(true)
      expect(await store.exists('plan', 'topic1')).toBe(false)
    })

    it('returns false when deleting non-existent artifact', async () => {
      expect(await store.delete('plan', 'nope')).toBe(false)
    })

    it('listAll returns full artifacts', async () => {
      await store.save('screening', 'p1', { paper_key: 'p1', decision: 'keep' } as ScreeningData)
      await store.save('screening', 'p2', { paper_key: 'p2', decision: 'reject' } as ScreeningData)

      const all = await store.listAll<ScreeningData>('screening')
      expect(all.length).toBe(2)
      expect(all.map(a => a.data.paper_key).sort()).toEqual(['p1', 'p2'])
    })
  })

  // ── Stage-specific queries ────────────────────────────────

  describe('stage-specific queries', () => {
    it('filters screenings by decision', async () => {
      await store.save('screening', 'p1', { paper_key: 'p1', decision: 'keep', title: 'Paper 1', reason: 'good' } as ScreeningData)
      await store.save('screening', 'p2', { paper_key: 'p2', decision: 'reject', title: 'Paper 2', reason: 'irrelevant' } as ScreeningData)
      await store.save('screening', 'p3', { paper_key: 'p3', decision: 'keep', title: 'Paper 3', reason: 'relevant' } as ScreeningData)
      await store.save('screening', 'p4', { paper_key: 'p4', decision: 'defer', title: 'Paper 4', reason: 'maybe' } as ScreeningData)

      const kept = await store.getScreeningByDecision('keep')
      expect(kept.length).toBe(2)
      expect(kept.map(a => a.data.paper_key).sort()).toEqual(['p1', 'p3'])

      const rejected = await store.getScreeningByDecision('reject')
      expect(rejected.length).toBe(1)
      expect(rejected[0].data.paper_key).toBe('p2')

      const deferred = await store.getScreeningByDecision('defer')
      expect(deferred.length).toBe(1)
    })

    it('filters decisions by verdict', async () => {
      await store.save('decision', 'p1', { paper_key: 'p1', decision: 'keep', title: 'P1', rationale: 'r' } as DecisionData)
      await store.save('decision', 'p2', { paper_key: 'p2', decision: 'revisit', title: 'P2', rationale: 'r' } as DecisionData)

      const kept = await store.getDecisionsByVerdict('keep')
      expect(kept.length).toBe(1)

      const revisit = await store.getDecisionsByVerdict('revisit')
      expect(revisit.length).toBe(1)
    })

    it('computes review queue', async () => {
      // Paper screened as 'keep'
      await store.save('screening', 'p1', { paper_key: 'p1', decision: 'keep', title: 'P1', reason: 'r' } as ScreeningData)
      await store.save('screening', 'p2', { paper_key: 'p2', decision: 'keep', title: 'P2', reason: 'r' } as ScreeningData)
      await store.save('screening', 'p3', { paper_key: 'p3', decision: 'reject', title: 'P3', reason: 'r' } as ScreeningData)

      // p1 already has a reading card
      await store.save('reading-card', 'p1', { paper_key: 'p1', title: 'P1', summary: 's', key_findings: [] } as ReadingCardData)

      const queue = await store.getReviewQueue()
      // p2 should be in the queue (kept but not reviewed), p1 should not (already reviewed), p3 should not (rejected)
      expect(queue).toContain('p2')
      expect(queue).not.toContain('p1')
      expect(queue).not.toContain('p3')
    })

    it('computes decision queue', async () => {
      // Papers with reading cards
      await store.save('reading-card', 'p1', { paper_key: 'p1', title: 'P1', summary: 's', key_findings: [] } as ReadingCardData)
      await store.save('reading-card', 'p2', { paper_key: 'p2', title: 'P2', summary: 's', key_findings: [] } as ReadingCardData)

      // p1 already has a decision
      await store.save('decision', 'p1', { paper_key: 'p1', decision: 'keep', title: 'P1', rationale: 'r' } as DecisionData)

      const queue = await store.getDecisionQueue()
      expect(queue).toContain('p2')
      expect(queue).not.toContain('p1')
    })

    it('saveScreeningBatch persists multiple per-paper artifacts', async () => {
      const saved = await store.saveScreeningBatch([
        {
          paper_key: 'paper-A',
          title: 'Paper A',
          decision: 'keep',
          reason: 'important',
        },
        {
          paper_key: 'paper-B',
          title: 'Paper B',
          decision: 'defer',
          reason: 'later',
        },
      ], {
        executionId: 'exec_batch',
        sourceStage: 'screening',
      })

      expect(saved.length).toBe(2)

      const a = await store.load('screening', 'paper-A')
      const b = await store.load('screening', 'paper-B')

      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
      expect(a!.meta.executionId).toBe('exec_batch')
      expect(b!.meta.executionId).toBe('exec_batch')
      expect(a!.data.decision).toBe('keep')
      expect(b!.data.decision).toBe('defer')
    })

    it('review queue deduplicates by canonical paper key', async () => {
      await store.save('screening', 'variant-1', {
        paper_key: 'Paper One',
        decision: 'keep',
        title: 'P1',
        reason: 'r',
      } as ScreeningData)
      await store.save('screening', 'variant-2', {
        paper_key: 'paper_one',
        decision: 'keep',
        title: 'P1 duplicate',
        reason: 'r',
      } as ScreeningData)

      const queue = await store.getReviewQueue()
      expect(queue.length).toBe(1)
    })
  })

  // ── Pipeline status ───────────────────────────────────────

  describe('pipeline status', () => {
    it('returns complete pipeline status', async () => {
      // Populate some artifacts
      await store.save('plan', 'topic1', { topic: 't1' } as PlanData)
      await store.save('screening', 'p1', { paper_key: 'p1', decision: 'keep', title: 'P1', reason: 'r' } as ScreeningData)
      await store.save('screening', 'p2', { paper_key: 'p2', decision: 'reject', title: 'P2', reason: 'r' } as ScreeningData)
      await store.save('reading-card', 'p1', { paper_key: 'p1', title: 'P1', summary: 's', key_findings: [] } as ReadingCardData)
      await store.save('decision', 'p1', { paper_key: 'p1', decision: 'keep', title: 'P1', rationale: 'r' } as DecisionData)
      await store.save('evidence-pack', 'ch3', { section: 'ch3', papers: [] } as EvidencePackData)
      await store.save('audit', 'ch3', { section: 'ch3', status: 'pass', issues: [] } as AuditData)

      const status = await store.getPipelineStatus()
      expect(status.plans).toBe(1)
      expect(status.screenings.total).toBe(2)
      expect(status.screenings.keep).toBe(1)
      expect(status.screenings.reject).toBe(1)
      expect(status.readingCards).toBe(1)
      expect(status.decisions.total).toBe(1)
      expect(status.decisions.keep).toBe(1)
      expect(status.evidencePacks).toBe(1)
      expect(status.audits.total).toBe(1)
      expect(status.audits.pass).toBe(1)
    })

    it('reports empty pipeline', async () => {
      const status = await store.getPipelineStatus()
      expect(status.plans).toBe(0)
      expect(status.screenings.total).toBe(0)
      expect(status.readingCards).toBe(0)
      expect(status.queues.reviewQueue).toBe(0)
      expect(status.queues.decisionQueue).toBe(0)
    })
  })

  // ── Clear ─────────────────────────────────────────────────

  describe('clear', () => {
    it('wipes all artifacts', async () => {
      await store.save('plan', 'topic1', { topic: 't1' } as PlanData)
      await store.save('screening', 'p1', { paper_key: 'p1' } as ScreeningData)

      await store.clear()

      expect(await store.list('plan')).toEqual([])
      expect(await store.list('screening')).toEqual([])
    })
  })
})
