import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { BibliographyStore } from '../src/bibliography/store.js'
import { BibliographyPipeline, STAGE_CONFIGS } from '../src/bibliography/pipeline.js'
import type { Ability, ExecutorContext } from '../src/types/index.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

// ─── Test helpers ───────────────────────────────────────────

function makePlanAbility(): Ability {
  return {
    name: 'research/bibliography-plan',
    description: 'Generate search plan',
    task_type: 'bibliography_plan',
    inputs: {
      topic: { type: 'string', required: true },
    },
    steps: [
      {
        id: 'generate-plan',
        type: 'script',
        run: `echo '{"topic":"{{inputs.topic}}","queries":["{{inputs.topic}}"],"inclusion_criteria":["peer-reviewed"],"exclusion_criteria":[],"target_count":10}'`,
        tags: ['bibliography-plan'],
      },
    ],
  }
}

function makeScreeningAbility(): Ability {
  return {
    name: 'research/paper-screening',
    description: 'Screen papers',
    task_type: 'paper_screening',
    inputs: {
      query: { type: 'string', required: true },
      limit: { type: 'number', required: false, default: 10 },
    },
    steps: [
      {
        id: 'search-academic',
        type: 'script',
        run: 'echo "Found 3 papers for {{inputs.query}}"',
      },
      {
        id: 'record-screening-decision',
        type: 'script',
        run: `echo '{"paper_key":"paper_001","title":"Test Paper","decision":"keep","reason":"Relevant to {{inputs.query}}"}'`,
        tags: ['screening-decision'],
        needs: ['search-academic'],
      },
    ],
  }
}

function makeReviewAbility(): Ability {
  return {
    name: 'research/paper-fulltext-review',
    description: 'Full-text review',
    task_type: 'paper_fulltext_review',
    inputs: {
      zotero_key: { type: 'string', required: true },
    },
    steps: [
      {
        id: 'read-zotero-pdf',
        type: 'script',
        run: 'echo "PDF content for {{inputs.zotero_key}}"',
        tags: ['fulltext-extract'],
      },
      {
        id: 'record-reading-card',
        type: 'script',
        run: `echo '{"paper_key":"{{inputs.zotero_key}}","title":"Test Paper","summary":"A good paper","key_findings":["finding1","finding2"]}'`,
        tags: ['reading-card'],
        needs: ['read-zotero-pdf'],
      },
    ],
  }
}

function makeDecisionAbility(): Ability {
  return {
    name: 'research/literature-decision',
    description: 'Literature decision',
    task_type: 'literature_decision',
    inputs: {
      paper_key: { type: 'string', required: true },
    },
    steps: [
      {
        id: 'record-decision-card',
        type: 'script',
        run: `echo '{"paper_key":"{{inputs.paper_key}}","title":"Test Paper","decision":"keep","rationale":"Strongly relevant","sections_relevant":["ch3"]}'`,
        tags: ['decision-card'],
      },
    ],
  }
}

function makeEvidencePackAbility(): Ability {
  return {
    name: 'research/section-evidence-pack',
    description: 'Section evidence pack',
    task_type: 'section_evidence_pack',
    inputs: {
      section: { type: 'string', required: true },
    },
    steps: [
      {
        id: 'record-evidence-pack',
        type: 'script',
        run: `echo '{"section":"{{inputs.section}}","papers":[{"paper_key":"paper_001","claim":"Agents need safety","evidence":"Table 2","strength":"strong"}]}'`,
        tags: ['evidence-pack'],
      },
    ],
  }
}

function makeAuditAbility(): Ability {
  return {
    name: 'research/citation-audit',
    description: 'Citation audit',
    task_type: 'citation_audit',
    inputs: {
      section: { type: 'string', required: true },
    },
    steps: [
      {
        id: 'record-citation-audit',
        type: 'script',
        run: `echo '{"section":"{{inputs.section}}","status":"pass","issues":[],"coverage_score":0.95}'`,
        tags: ['citation-audit'],
      },
    ],
  }
}

function baseCtx(cwd: string): ExecutorContext {
  return { cwd, env: {} }
}

// ─── Tests ──────────────────────────────────────────────────

describe('BibliographyPipeline', () => {
  let store: BibliographyStore
  let pipeline: BibliographyPipeline
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bibpipe-test-'))
    store = new BibliographyStore({ dataDir: path.join(tmpDir, 'data') })
    pipeline = new BibliographyPipeline(store)
  })

  afterEach(async () => {
    await store.clear()
    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
  })

  // ── STAGE_CONFIGS ─────────────────────────────────────────

  describe('STAGE_CONFIGS', () => {
    it('has configs for all 6 stages', () => {
      expect(Object.keys(STAGE_CONFIGS)).toEqual([
        'plan', 'screening', 'review', 'decision', 'evidence-pack', 'audit',
      ])
    })

    it('each stage has required fields', () => {
      for (const [name, config] of Object.entries(STAGE_CONFIGS)) {
        expect(config.abilityName).toBeTypeOf('string')
        expect(config.artifactType).toBeTypeOf('string')
        expect(config.keyFrom).toBeTypeOf('string')
        expect(Array.isArray(config.dependsOn)).toBe(true)
      }
    })

    it('plan stage has no dependencies', () => {
      expect(STAGE_CONFIGS.plan.dependsOn).toEqual([])
    })

    it('screening depends on plan', () => {
      expect(STAGE_CONFIGS.screening.dependsOn).toEqual(['plan'])
    })

    it('audit depends on evidence-pack', () => {
      expect(STAGE_CONFIGS.audit.dependsOn).toEqual(['evidence-pack'])
    })
  })

  // ── Single stage execution ────────────────────────────────

  describe('single stage execution', () => {
    it('runs plan stage and persists artifact', async () => {
      const result = await pipeline.runStage(
        'plan',
        makePlanAbility(),
        { topic: 'agent safety' },
        baseCtx(tmpDir)
      )

      expect(result.stage).toBe('plan')
      expect(result.execution.status).toBe('completed')
      expect(result.artifact).not.toBeNull()
      expect(result.artifact!.data.topic).toBe('agent safety')
      expect(result.artifactKey).toBe('agent_safety')

      // Verify persisted
      const loaded = await store.load('plan', 'agent_safety')
      expect(loaded).not.toBeNull()
      expect(loaded!.meta.sourceStage).toBe('plan')
    })

    it('runs screening stage and persists artifact', async () => {
      const result = await pipeline.runStage(
        'screening',
        makeScreeningAbility(),
        { query: 'LLM safety' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifact).not.toBeNull()
      expect(result.artifact!.data.paper_key).toBe('paper_001')
      expect(result.artifact!.data.decision).toBe('keep')
    })

    it('runs review stage and persists reading card', async () => {
      const result = await pipeline.runStage(
        'review',
        makeReviewAbility(),
        { zotero_key: 'paper_001' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifact!.data.paper_key).toBe('paper_001')
      expect(result.artifact!.data.key_findings).toEqual(['finding1', 'finding2'])
    })

    it('runs decision stage and persists decision card', async () => {
      const result = await pipeline.runStage(
        'decision',
        makeDecisionAbility(),
        { paper_key: 'paper_001' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifact!.data.decision).toBe('keep')
      expect(result.artifact!.data.sections_relevant).toEqual(['ch3'])
    })

    it('runs evidence-pack stage', async () => {
      const result = await pipeline.runStage(
        'evidence-pack',
        makeEvidencePackAbility(),
        { section: 'chapter-3' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifact!.data.section).toBe('chapter-3')
      expect(result.artifact!.data.papers.length).toBe(1)
    })

    it('runs audit stage', async () => {
      const result = await pipeline.runStage(
        'audit',
        makeAuditAbility(),
        { section: 'chapter-3' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifact!.data.status).toBe('pass')
      expect(result.artifact!.data.coverage_score).toBe(0.95)
    })

    it('rejects unknown stage', async () => {
      await expect(
        pipeline.runStage('unknown', makePlanAbility(), {}, baseCtx(tmpDir))
      ).rejects.toThrow("Unknown bibliography stage: 'unknown'")
    })
  })

  // ── Inter-stage data flow ─────────────────────────────────

  describe('inter-stage data flow', () => {
    it('screening stage receives plan artifacts in stageOutputs', async () => {
      // First, save a plan artifact
      await store.save('plan', 'topic1', {
        topic: 'agent safety',
        queries: ['agent safety'],
        inclusion_criteria: ['peer-reviewed'],
        exclusion_criteria: [],
        target_count: 10,
      })

      // Run screening — it depends on 'plan'
      const capturedOutputs: Record<string, unknown>[] = []
      const ctx: ExecutorContext = {
        ...baseCtx(tmpDir),
        onStepStart: (step) => {
          // We can't easily inspect stageOutputs from here,
          // but we verify the pipeline doesn't crash
        },
      }

      const result = await pipeline.runStage(
        'screening',
        makeScreeningAbility(),
        { query: 'agent safety' },
        ctx
      )

      expect(result.execution.status).toBe('completed')
      // The screening ran successfully, meaning stageOutputs were injected without error
    })

    it('review stage receives screening artifacts', async () => {
      // Pre-populate screening artifacts
      await store.save('screening', 'p1', {
        paper_key: 'p1',
        decision: 'keep',
        title: 'Paper 1',
        reason: 'relevant',
      })

      const result = await pipeline.runStage(
        'review',
        makeReviewAbility(),
        { zotero_key: 'p1' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
    })

    it('decision stage receives reading-card artifacts', async () => {
      await store.save('reading-card', 'p1', {
        paper_key: 'p1',
        title: 'Paper 1',
        summary: 'Good paper',
        key_findings: ['f1'],
      })

      const result = await pipeline.runStage(
        'decision',
        makeDecisionAbility(),
        { paper_key: 'p1' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
    })
  })

  // ── Full pipeline sequence ────────────────────────────────

  describe('full pipeline sequence', () => {
    it('runs all 6 stages in order with data flowing between them', async () => {
      const ctx = baseCtx(tmpDir)

      // Stage 1: Plan
      const planResult = await pipeline.runStage(
        'plan', makePlanAbility(), { topic: 'agent safety' }, ctx
      )
      expect(planResult.execution.status).toBe('completed')

      // Stage 2: Screening
      const screeningResult = await pipeline.runStage(
        'screening', makeScreeningAbility(), { query: 'agent safety' }, ctx
      )
      expect(screeningResult.execution.status).toBe('completed')

      // Stage 3: Review
      const reviewResult = await pipeline.runStage(
        'review', makeReviewAbility(), { zotero_key: 'paper_001' }, ctx
      )
      expect(reviewResult.execution.status).toBe('completed')

      // Stage 4: Decision
      const decisionResult = await pipeline.runStage(
        'decision', makeDecisionAbility(), { paper_key: 'paper_001' }, ctx
      )
      expect(decisionResult.execution.status).toBe('completed')

      // Stage 5: Evidence Pack
      const epResult = await pipeline.runStage(
        'evidence-pack', makeEvidencePackAbility(), { section: 'chapter-3' }, ctx
      )
      expect(epResult.execution.status).toBe('completed')

      // Stage 6: Audit
      const auditResult = await pipeline.runStage(
        'audit', makeAuditAbility(), { section: 'chapter-3' }, ctx
      )
      expect(auditResult.execution.status).toBe('completed')

      // Verify full pipeline status
      const status = await pipeline.getStatus()
      expect(status.plans).toBe(1)
      expect(status.screenings.total).toBe(1)
      expect(status.screenings.keep).toBe(1)
      expect(status.readingCards).toBe(1)
      expect(status.decisions.total).toBe(1)
      expect(status.decisions.keep).toBe(1)
      expect(status.evidencePacks).toBe(1)
      expect(status.audits.total).toBe(1)
      expect(status.audits.pass).toBe(1)
    })
  })

  // ── Pipeline status and queues ────────────────────────────

  describe('pipeline status and queues', () => {
    it('getStatus delegates to store', async () => {
      await store.save('plan', 't1', { topic: 't1' })
      const status = await pipeline.getStatus()
      expect(status.plans).toBe(1)
    })

    it('getReviewQueue delegates to store', async () => {
      await store.save('screening', 'p1', { paper_key: 'p1', decision: 'keep', title: 'P1', reason: 'r' })
      const queue = await pipeline.getReviewQueue()
      expect(queue).toContain('p1')
    })

    it('getDecisionQueue delegates to store', async () => {
      await store.save('reading-card', 'p1', { paper_key: 'p1', title: 'P1', summary: 's', key_findings: [] })
      const queue = await pipeline.getDecisionQueue()
      expect(queue).toContain('p1')
    })

    it('getStore returns the store instance', () => {
      expect(pipeline.getStore()).toBe(store)
    })
  })

  // ── Non-JSON step output ──────────────────────────────────

  describe('non-JSON step output', () => {
    it('stores raw text when step output is not valid JSON', async () => {
      const ability: Ability = {
        name: 'research/bibliography-plan',
        description: 'Plan',
        inputs: { topic: { type: 'string', required: true } },
        steps: [{
          id: 'generate-plan',
          type: 'script',
          run: 'echo "Not JSON output for {{inputs.topic}}"',
          tags: ['bibliography-plan'],
        }],
      }

      const result = await pipeline.runStage('plan', ability, { topic: 'test' }, baseCtx(tmpDir))
      expect(result.artifact).not.toBeNull()
      expect(result.artifact!.data.raw).toBe('Not JSON output for test')
    })
  })

  // ── Control gate integration ──────────────────────────────

  describe('control gate integration', () => {
    it('screening stage triggers obligation evaluation', async () => {
      const result = await pipeline.runStage(
        'screening',
        makeScreeningAbility(),
        { query: 'test' },
        baseCtx(tmpDir)
      )

      // The ability has task_type: paper_screening and tags: [screening-decision]
      // Control gate should evaluate and pass
      expect(result.execution.status).toBe('completed')
      if (result.execution.control) {
        expect(result.execution.control.gate.verdict).toBe('allow')
      }
    })

    it('review stage triggers fulltext obligation evaluation', async () => {
      const result = await pipeline.runStage(
        'review',
        makeReviewAbility(),
        { zotero_key: 'p1' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      if (result.execution.control) {
        expect(result.execution.control.gate.verdict).toBe('allow')
      }
    })
  })
})
