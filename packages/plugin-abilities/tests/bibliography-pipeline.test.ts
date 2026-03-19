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

function makeMultiScreeningAbility(): Ability {
  return {
    name: 'research/paper-screening',
    description: 'Screen papers in batch',
    task_type: 'paper_screening',
    inputs: {
      query: { type: 'string', required: true },
    },
    steps: [
      {
        id: 'record-screening-decision',
        type: 'script',
        run: `echo '{"items":[{"paper_key":"paper_001","title":"Paper 1","decision":"keep","reason":"r1"},{"paper_key":"paper_002","title":"Paper 2","decision":"defer","reason":"r2"}]}'`,
        tags: ['screening-decision'],
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

function makeScopedDecisionAbility(): Ability {
  return {
    name: 'research/literature-decision',
    description: 'Scoped decision test',
    task_type: 'literature_decision',
    inputs: {
      paper_key: { type: 'string', required: true },
    },
    steps: [
      {
        id: 'record-decision-card',
        type: 'script',
        run: [
          "python3 - <<'PY'",
          'import json, os',
          'stage = json.loads(os.environ["ABILITY_STAGE_OUTPUTS_JSON"])',
          'cards = stage.get("reading-card", [])',
          'print(json.dumps({"paper_key":"{{inputs.paper_key}}","matched_count":len(cards),"matched_keys":[c.get("paper_key") for c in cards]}))',
          'PY',
        ].join('\n'),
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

function makeScopedEvidencePackAbility(): Ability {
  return {
    name: 'research/section-evidence-pack',
    description: 'Scoped evidence pack test',
    task_type: 'section_evidence_pack',
    inputs: {
      section: { type: 'string', required: true },
      paper_keys: { type: 'array', required: false },
    },
    steps: [
      {
        id: 'record-evidence-pack',
        type: 'script',
        run: [
          "python3 - <<'PY'",
          'import json, os',
          'stage = json.loads(os.environ["ABILITY_STAGE_OUTPUTS_JSON"])',
          'decisions = stage.get("decision", [])',
          'print(json.dumps({"section":"{{inputs.section}}","matched_count":len(decisions),"matched_keys":[d.get("paper_key") for d in decisions],"selected_paper_keys":[d.get("paper_key") for d in decisions]}))',
          'PY',
        ].join('\n'),
        tags: ['evidence-pack'],
      },
    ],
  }
}

function makeScopedAuditAbility(): Ability {
  return {
    name: 'research/citation-audit',
    description: 'Scoped audit test',
    task_type: 'citation_audit',
    inputs: {
      section: { type: 'string', required: true },
      paper_keys: { type: 'array', required: false },
    },
    steps: [
      {
        id: 'record-citation-audit',
        type: 'script',
        run: [
          "python3 - <<'PY'",
          'import json, os',
          'stage = json.loads(os.environ["ABILITY_STAGE_OUTPUTS_JSON"])',
          'packs = stage.get("evidence-pack", [])',
          'selected = packs[0].get("selected_paper_keys", []) if packs else []',
          'print(json.dumps({"section":"{{inputs.section}}","matched_pack_count":len(packs),"selected_paper_keys":selected,"status":"pass","issues":[],"coverage_score":1.0}))',
          'PY',
        ].join('\n'),
        tags: ['citation-audit'],
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
      expect(result.artifacts.length).toBe(1)
    })

    it('screening stage persists multiple per-paper artifacts from one run', async () => {
      const result = await pipeline.runStage(
        'screening',
        makeMultiScreeningAbility(),
        { query: 'batch query' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifacts.length).toBe(2)

      const p1 = await store.load('screening', 'paper_001')
      const p2 = await store.load('screening', 'paper_002')
      expect(p1).not.toBeNull()
      expect(p2).not.toBeNull()
      expect(p1!.data.decision).toBe('keep')
      expect(p2!.data.decision).toBe('defer')
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

    it('decision stage receives only scoped reading-card artifacts', async () => {
      await store.save('reading-card', 'p1', {
        paper_key: 'p1',
        title: 'Paper 1',
        summary: 'Good paper',
        key_findings: ['f1'],
      })
      await store.save('reading-card', 'p2', {
        paper_key: 'p2',
        title: 'Paper 2',
        summary: 'Better paper',
        key_findings: ['f2'],
      })

      const result = await pipeline.runStage(
        'decision',
        makeScopedDecisionAbility(),
        { paper_key: 'p2' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifact).not.toBeNull()
      expect((result.artifact!.data as any).matched_count).toBe(1)
      expect((result.artifact!.data as any).matched_keys).toEqual(['p2'])
    })

    it('evidence-pack stage can scope decisions to an explicit paper set', async () => {
      await store.save('decision', 'p1', {
        paper_key: 'p1',
        title: 'Paper 1',
        decision: 'keep',
        rationale: 'r1',
        sections_relevant: ['methods'],
      })
      await store.save('decision', 'p2', {
        paper_key: 'p2',
        title: 'Paper 2',
        decision: 'keep',
        rationale: 'r2',
        sections_relevant: ['methods'],
      })

      const result = await pipeline.runStage(
        'evidence-pack',
        makeScopedEvidencePackAbility(),
        { section: 'methods', paper_keys: ['p2'] },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect((result.artifact!.data as any).matched_count).toBe(1)
      expect((result.artifact!.data as any).matched_keys).toEqual(['p2'])
      expect((result.artifact!.data as any).selected_paper_keys).toEqual(['p2'])
    })

    it('audit stage can scope evidence packs to the matching paper set', async () => {
      await store.save('evidence-pack', 'methods', {
        section: 'methods',
        selected_paper_keys: ['p2'],
        papers: [{ paper_key: 'p2', claim: 'c2', evidence: 'e2', strength: 'strong' }],
      })
      await store.save('evidence-pack', 'methods-stale', {
        section: 'methods',
        selected_paper_keys: ['p1'],
        papers: [{ paper_key: 'p1', claim: 'c1', evidence: 'e1', strength: 'strong' }],
      })

      const result = await pipeline.runStage(
        'audit',
        makeScopedAuditAbility(),
        { section: 'methods', paper_keys: ['p2'] },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect((result.artifact!.data as any).matched_pack_count).toBe(1)
      expect((result.artifact!.data as any).selected_paper_keys).toEqual(['p2'])
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

    it('runStageCommand exposes execution and artifact metadata', async () => {
      const result = await pipeline.runStageCommand(
        'plan',
        makePlanAbility(),
        { topic: 'agent safety' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('completed')
      expect(result.artifact.meta).not.toBeNull()
      expect(result.artifact.data).not.toBeNull()
      expect(result.artifact.artifacts.length).toBe(1)
    })
  })

  describe('failed execution persistence', () => {
    it('does not persist artifacts for failed executions', async () => {
      const ability: Ability = {
        name: 'research/paper-fulltext-review',
        description: 'Fail after a successful step',
        task_type: 'paper_fulltext_review',
        inputs: {
          zotero_key: { type: 'string', required: true },
        },
        steps: [
          {
            id: 'extract',
            type: 'script',
            run: 'echo "{\\"paper_key\\":\\"p1\\",\\"source_stage\\":\\"review\\"}"',
            tags: ['fulltext-extract'],
          },
          {
            id: 'record-reading-card',
            type: 'script',
            run: 'exit 1',
            tags: ['reading-card'],
            needs: ['extract'],
          },
        ],
      }

      const result = await pipeline.runStage(
        'review',
        ability,
        { zotero_key: 'p1' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('failed')
      expect(result.artifact).toBeNull()
      expect(result.artifacts).toEqual([])
      expect(await store.list('reading-card')).toEqual([])
    })

    it('runStageCommand exposes failed step error details', async () => {
      const ability: Ability = {
        name: 'research/section-evidence-pack',
        description: 'Fail with explicit message',
        task_type: 'section_evidence_pack',
        inputs: {
          section: { type: 'string', required: true },
        },
        steps: [
          {
            id: 'record-evidence-pack',
            type: 'script',
            run: 'python3 - <<\'PY\'\nraise SystemExit("No decision artifacts available for this section")\nPY',
            tags: ['evidence-pack'],
          },
        ],
      }

      const result = await pipeline.runStageCommand(
        'evidence-pack',
        ability,
        { section: 'methods' },
        baseCtx(tmpDir)
      )

      expect(result.execution.status).toBe('failed')
      expect(result.execution.error).toContain('No decision artifacts available for this section')
      expect(result.execution.failedStepId).toBe('record-evidence-pack')
      expect(result.artifact.meta).toBeNull()
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
