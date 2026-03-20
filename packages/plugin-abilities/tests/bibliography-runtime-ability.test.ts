import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { loadAbility } from '../src/loader/index.js'
import { executeAbility } from '../src/executor/index.js'
import type { ExecutorContext } from '../src/types/index.js'

function createContext(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    cwd: process.cwd(),
    env: {},
    ...overrides,
  }
}

function createResearchAgentMock(): NonNullable<ExecutorContext['agents']> {
  return {
    async call(options) {
      const prompt = options.prompt
      const paperKeys = [...prompt.matchAll(/"paper_key"\s*:\s*"([^"]+)"/g)].map((match) => match[1])
      const uniquePaperKeys = [...new Set(paperKeys)]
      const primaryPaperKey = uniquePaperKeys[0] ?? 'UNKNOWN'

      switch (options.step?.id) {
        case 'record-reading-card':
          return JSON.stringify({
            paper_key: primaryPaperKey,
            title: `Structured reading card for ${primaryPaperKey}`,
            summary: `Structured summary for ${primaryPaperKey} focused on optimization method and thesis relevance.`,
            key_findings: [
              `${primaryPaperKey} addresses an optimization problem.`,
              `${primaryPaperKey} provides a methodologically relevant approach.`,
              `${primaryPaperKey} is useful for thesis positioning.`,
            ],
            methodology: 'Structured method extraction',
            relevance_notes: 'Useful for the graduation thesis literature review.',
            anchors_count: 3,
            sufficiency_score: 0.78,
            uncertainty_level: 'moderate',
            source_text_length: 2048,
            source_excerpt: 'Method-focused excerpt.',
            source_stage: 'review',
            stage: 'full-review',
          })
        case 'record-decision-card':
          return JSON.stringify({
            paper_key: primaryPaperKey,
            title: `Decision card for ${primaryPaperKey}`,
            decision: 'keep',
            rationale: `Keep ${primaryPaperKey} because it is directly relevant to the thesis.`,
            sections_relevant: ['methods', 'advanced-methods'],
            consistency_ok: true,
            based_on_reading_card: primaryPaperKey,
            source_stage: 'decision',
          })
        case 'record-evidence-pack':
          return JSON.stringify({
            section: 'methods',
            selected_paper_keys: uniquePaperKeys,
            papers: uniquePaperKeys.map((paperKey) => ({
              paper_key: paperKey,
              claim: `${paperKey} contributes a method comparison point.`,
              evidence: `${paperKey} provides evidence from the structured decision artifact.`,
              strength: 'strong',
            })),
            anchors_count: uniquePaperKeys.length,
            sufficiency_score: 0.86,
            grounded_claims: uniquePaperKeys.length,
            total_claims: uniquePaperKeys.length,
            source_stage: 'evidence-pack',
          })
        default:
          return JSON.stringify({ ok: true })
      }
    },
  }
}

function shellEchoJson(payload: Record<string, unknown>): string {
  return `echo '${JSON.stringify(payload).replace(/'/g, `'\\''`)}'`
}

function overrideStepRunById(
  ability: { steps: Array<{ id: string; run: string }> },
  stepId: string,
  run: string
): void {
  const index = ability.steps.findIndex((step) => step.id === stepId)
  if (index === -1) {
    throw new Error(`Step '${stepId}' not found in ability '${(ability as any).name ?? 'unknown'}'`)
  }
  ability.steps[index] = {
    ...ability.steps[index],
    run,
  }
}

describe('bibliography runtime abilities', () => {
  const projectDir = resolve(import.meta.dir, '..', '..', '..', '.opencode', 'abilities')

  it('bibliography-plan derives plan data from upstream search evidence', async () => {
    const loaded = await loadAbility('research/bibliography-plan', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'search-academic-landscape', shellEchoJson({
        query: 'agent safety',
        result_count: 2,
        results: [
          {
            title: 'Agent safety benchmark',
            provider: 'openalex',
            url: 'https://openalex.org/W1',
            metadata: {
              year: 2024,
              type: 'article',
            },
          },
          {
            title: 'Reliable evaluation for agent safety',
            provider: 'arxiv',
            url: 'https://arxiv.org/abs/1234.5678',
            metadata: {
              year: 2023,
              type: 'article',
            },
          },
        ],
      }))
    overrideStepRunById(ability as any, 'search-zotero-coverage', shellEchoJson({
        query: 'agent safety',
        result_count: 1,
        items: [
          {
            key: 'ABCD1234',
            title: 'Existing Zotero agent safety paper',
            date: '2024',
            item_type: 'journalArticle',
          },
        ],
      }))

    const execution = await executeAbility(
      ability,
      { topic: 'agent safety' },
      createContext()
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.topic).toBe('agent safety')
    expect(output.queries).toEqual([
      'agent safety',
      'agent safety systematic review',
      'agent safety survey',
    ])
    expect(output.direction_summary).toContain('explicitly stay within agent safety')
    expect(output.search_profile.normalized_focus_query).toBe('agent safety')
    expect(output.search_profile.search_queries).toEqual([
      'agent safety',
      'agent safety systematic review',
      'agent safety survey',
    ])
    expect(output.search_profile.required_terms).toEqual(['agent', 'safety'])
    expect(output.search_profile.required_phrases).toEqual(['agent safety'])
    expect(output.search_profile.screening_hints.require_support_field_match).toBe(true)
    expect(output.search_summary.academic_result_count).toBe(2)
    expect(output.search_summary.zotero_result_count).toBe(1)
    expect(output.plan_status).toBe('ready')
    expect(output.warnings).toEqual([])
    expect(output.candidate_papers.academic[0].title).toBe('Agent safety benchmark')
    expect(output.candidate_papers.zotero[0].key).toBe('ABCD1234')
  })

  it('bibliography-plan surfaces warnings when coverage is empty or degraded', async () => {
    const loaded = await loadAbility('research/bibliography-plan', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    ability.steps[0] = {
      ...ability.steps[0],
      run: shellEchoJson({
        query: 'rare topic',
        result_count: 0,
        results: [],
        warning: 'academic search timed out or failed',
      }),
    }
    ability.steps[1] = {
      ...ability.steps[1],
      run: shellEchoJson({
        query: 'rare topic',
        result_count: 0,
        items: [],
      }),
    }

    const execution = await executeAbility(
      ability,
      { topic: 'rare topic' },
      createContext()
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.plan_status).toBe('degraded')
    expect(output.search_summary.warning_count).toBe(2)
    expect(output.warnings.map((warning: Record<string, unknown>) => warning.code)).toEqual([
      'academic-search-warning',
      'no-search-coverage',
    ])
  })

  it('bibliography-plan preserves supply-chain anchors for thesis-style topics', async () => {
    const loaded = await loadAbility('research/bibliography-plan', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'search-academic-landscape', shellEchoJson({
      query: 'integrated supply chain optimization with milp baseline and learning-assisted extensions',
      result_count: 1,
      results: [
        {
          title: 'Supply chain optimization with mixed-integer programming',
          provider: 'openalex',
          url: 'https://openalex.org/W99',
          metadata: {
            year: 2024,
            type: 'article',
          },
        },
      ],
    }))
    overrideStepRunById(ability as any, 'search-zotero-coverage', shellEchoJson({
      query: 'integrated supply chain optimization with milp baseline and learning-assisted extensions',
      result_count: 0,
      items: [],
    }))

    const execution = await executeAbility(
      ability,
      { topic: 'integrated supply chain optimization with milp baseline and learning-assisted extensions' },
      createContext()
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.search_profile.normalized_focus_query).toBe('supply chain optimization')
    expect(output.search_profile.required_terms).toEqual(['supply', 'chain', 'optimization'])
    expect(output.search_profile.required_phrases).toEqual(['supply chain'])
    expect(output.search_profile.support_terms[0]).toBe('milp')
    expect(output.search_profile.search_queries).toEqual([
      'supply chain optimization',
      'supply chain optimization milp',
      'supply chain optimization systematic review',
      'supply chain optimization survey',
    ])
  })

  it('paper-fulltext-review derives reading card content from text_preview', async () => {
    const loaded = await loadAbility('research/paper-fulltext-review', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'read-zotero-pdf', shellEchoJson({
        item_key: 'TEST1234',
        text_preview: 'Preview sentence one. Preview sentence two.',
        text_length: 2048,
        extraction_status: 'ok',
      }))

    const execution = await executeAbility(
      ability,
      { zotero_key: 'TEST1234' },
      createContext({
        agents: createResearchAgentMock(),
      })
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, unknown>
    expect(output.summary).toContain('Structured summary for TEST1234')
    expect(output.methodology).toBe('Structured method extraction')
    expect(output.relevance_notes).toContain('graduation thesis')
    expect(output.sufficiency_score).toBe(0.78)
    expect(output.uncertainty_level).toBe('moderate')
    expect(output.source_text_length).toBe(2048)
  })

  it('literature-decision uses stage artifacts to produce a structured decision', async () => {
    const loaded = await loadAbility('research/literature-decision', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const execution = await executeAbility(
      structuredClone(loaded!.ability),
      { paper_key: 'TEST1234' },
      createContext({
        agents: createResearchAgentMock(),
        stageOutputs: {
          'reading-card': [
            {
              paper_key: 'TEST1234',
              title: 'Structured reading card for TEST1234',
              summary: 'Structured summary',
              methodology: 'MILP with hybrid extension',
              relevance_notes: 'Useful for the thesis',
              sufficiency_score: 0.8,
              uncertainty_level: 'moderate',
            },
          ],
        },
      })
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.paper_key).toBe('TEST1234')
    expect(output.decision).toBe('keep')
    expect(output.sections_relevant).toEqual(['methods', 'advanced-methods'])
  })

  it('section-evidence-pack uses scoped decision artifacts in agent synthesis', async () => {
    const loaded = await loadAbility('research/section-evidence-pack', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const execution = await executeAbility(
      structuredClone(loaded!.ability),
      { section: 'methods', paper_keys: ['P1', 'P2'] },
      createContext({
        agents: createResearchAgentMock(),
        stageOutputs: {
          decision: [
            {
              paper_key: 'P1',
              decision: 'keep',
              rationale: 'r1',
              sections_relevant: ['methods'],
            },
            {
              paper_key: 'P2',
              decision: 'keep',
              rationale: 'r2',
              sections_relevant: ['methods'],
            },
          ],
        },
      })
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.selected_paper_keys).toEqual(['P1', 'P2'])
    expect(output.anchors_count).toBe(2)
  })

  it('paper-screening filters weak academic matches and keeps stronger evidence', async () => {
    const loaded = await loadAbility('research/paper-screening', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'search-academic', shellEchoJson({
        query: 'agent safety',
        result_count: 3,
        results: [
          {
            title: 'Agent safety benchmark for tool-using systems',
            provider: 'openalex',
            url: 'https://openalex.org/W1',
            snippet: 'Benchmarks for evaluating agent safety in autonomous systems.',
            metadata: { year: 2024 },
          },
          {
            title: 'Topics in category theory',
            provider: 'openalex',
            url: 'https://openalex.org/W2',
            snippet: 'A doctoral thesis on higher categories and algebraic topology.',
            metadata: { year: 2021 },
          },
          {
            title: 'Reliable control for agent safety systems',
            provider: 'arxiv',
            url: 'https://arxiv.org/abs/1234.5678',
            snippet: 'Control-oriented techniques for agent safety evaluation.',
            metadata: { year: 2023 },
          },
        ],
        queries_used: ['agent safety', 'agent safety review'],
        plan_applied: false,
      }))
    overrideStepRunById(ability as any, 'search-zotero', shellEchoJson({
        query: 'agent safety',
        result_count: 1,
        items: [
          {
            key: 'ABCD1234',
            title: 'Existing Zotero agent safety paper',
            date: '2024',
            item_type: 'journalArticle',
          },
        ],
        queries_used: ['agent safety'],
        plan_applied: false,
      }))

    const execution = await executeAbility(
      ability,
      { query: 'agent safety', limit: 10 },
      createContext()
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.items).toHaveLength(3)
    expect(output.items.map((item: Record<string, unknown>) => item.title)).toEqual([
      'Agent safety benchmark for tool-using systems',
      'Reliable control for agent safety systems',
      'Existing Zotero agent safety paper',
    ])
    expect(output.search_summary.filtered_academic_result_count).toBe(1)
    expect(output.search_summary.plan_applied).toBe(false)
    expect(output.search_summary.academic_queries_used).toEqual(['agent safety', 'agent safety review'])
    expect(output.screening_status).toBe('ready')
    expect(output.warnings).toEqual([])
    expect(output.anchors_count).toBe(3)
    expect(output.uncertainty_level).toBe('moderate')
  })

  it('paper-screening returns empty evidence when academic hits are only weak matches', async () => {
    const loaded = await loadAbility('research/paper-screening', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'search-academic', shellEchoJson({
        query: 'zzzxxyyqqq unlikely thesis query',
        result_count: 2,
        results: [
          {
            title: 'PhD thesis on category theory',
            provider: 'openalex',
            url: 'https://openalex.org/W9',
            snippet: 'Category theory structures for higher-dimensional topology.',
            metadata: { year: 2022 },
          },
          {
            title: 'The Penrose inequality in asymptotically hyperbolic spaces',
            provider: 'arxiv',
            url: 'https://arxiv.org/abs/9999.0001',
            snippet: 'A geometry paper unrelated to thesis workflow validation.',
            metadata: { year: 2020 },
          },
        ],
        queries_used: ['zzzxxyyqqq unlikely thesis query'],
        plan_applied: false,
      }))
    overrideStepRunById(ability as any, 'search-zotero', shellEchoJson({
        query: 'zzzxxyyqqq unlikely thesis query',
        result_count: 0,
        items: [],
        queries_used: ['zzzxxyyqqq unlikely thesis query'],
        plan_applied: false,
      }))

    const execution = await executeAbility(
      ability,
      { query: 'zzzxxyyqqq unlikely thesis query', limit: 10 },
      createContext()
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.items).toEqual([])
    expect(output.search_summary.filtered_academic_result_count).toBe(2)
    expect(output.sufficiency_score).toBe(0.25)
    expect(output.uncertainty_level).toBe('high')
    expect(output.screening_status).toBe('ready')
    expect(output.warnings).toEqual([])
  })

  it('paper-screening uses bibliography plan search profile before searching', async () => {
    const loaded = await loadAbility('research/paper-screening', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'search-academic', `python3 - <<'PY'
import json
import os

step_outputs = json.loads(os.environ.get("ABILITY_STEP_OUTPUTS_JSON", "{}"))
profile = json.loads(step_outputs["derive-search-profile"]["output"])
print(json.dumps({
  "query": "graduation thesis literature review on agent safety for optimization",
  "result_count": 1,
  "queries_used": profile["search_queries"],
  "plan_applied": profile["plan_applied"],
  "results": [
    {
      "title": "Agent safety for optimization systems",
      "provider": "openalex",
      "url": "https://openalex.org/W42",
      "snippet": "Optimization workflows require explicit agent safety checks.",
      "metadata": {"year": 2024},
      "_matched_query": profile["search_queries"][0],
    }
  ],
}))
PY`)
    overrideStepRunById(ability as any, 'search-zotero', `python3 - <<'PY'
import json
import os

step_outputs = json.loads(os.environ.get("ABILITY_STEP_OUTPUTS_JSON", "{}"))
profile = json.loads(step_outputs["derive-search-profile"]["output"])
print(json.dumps({
  "query": "graduation thesis literature review on agent safety for optimization",
  "result_count": 0,
  "queries_used": profile["search_queries"],
  "plan_applied": profile["plan_applied"],
  "items": [],
}))
PY`)

    const execution = await executeAbility(
      ability,
      {
        query: 'graduation thesis literature review on agent safety for optimization',
        limit: 10,
      },
      {
        ...createContext(),
        stageOutputs: {
          plan: [
            {
              topic: 'graduation thesis literature review on agent safety for optimization',
              search_profile: {
                normalized_focus_query: 'agent safety optimization',
                search_queries: [
                  'agent safety optimization',
                  'agent safety optimization systematic review',
                ],
                required_terms: ['agent', 'safety'],
                support_terms: ['optimization'],
                required_phrases: ['agent safety'],
                excluded_terms: [],
                screening_hints: {
                  min_anchor_matches: 2,
                  require_support_field_match: true,
                },
              },
            },
          ],
        },
      }
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.search_summary.plan_applied).toBe(true)
    expect(output.search_summary.academic_queries_used).toEqual([
      'agent safety optimization',
      'agent safety optimization systematic review',
    ])
    expect(output.search_profile.normalized_focus_query).toBe('agent safety optimization')
    expect(output.search_profile.support_terms).toEqual(['optimization'])
    expect(output.search_profile.required_phrases).toEqual(['agent safety'])
    expect(output.items).toHaveLength(1)
    expect(output.items[0].matched_query).toBe('agent safety optimization')
    expect(output.screening_status).toBe('partial')
    expect(output.warnings.map((warning: Record<string, unknown>) => warning.code)).toEqual([
      'limited-screening-results',
    ])
  })

  it('paper-screening surfaces warning when plan-driven search returns no usable results', async () => {
    const loaded = await loadAbility('research/paper-screening', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    ability.steps[1] = {
      ...ability.steps[1],
      run: `python3 - <<'PY'
import json
import os

step_outputs = json.loads(os.environ.get("ABILITY_STEP_OUTPUTS_JSON", "{}"))
profile = json.loads(step_outputs["derive-search-profile"]["output"])
print(json.dumps({
  "query": "rare topic",
  "result_count": 0,
  "queries_used": profile["search_queries"],
  "plan_applied": profile["plan_applied"],
  "results": [],
  "warning": "academic search timed out or failed",
}))
PY`,
    }
    ability.steps[2] = {
      ...ability.steps[2],
      run: `python3 - <<'PY'
import json
import os

step_outputs = json.loads(os.environ.get("ABILITY_STEP_OUTPUTS_JSON", "{}"))
profile = json.loads(step_outputs["derive-search-profile"]["output"])
print(json.dumps({
  "query": "rare topic",
  "result_count": 0,
  "queries_used": profile["search_queries"],
  "plan_applied": profile["plan_applied"],
  "items": [],
}))
PY`,
    }

    const execution = await executeAbility(
      ability,
      { query: 'rare topic', limit: 5 },
      {
        ...createContext(),
        stageOutputs: {
          plan: [
            {
              topic: 'rare topic',
              search_profile: {
                normalized_focus_query: 'rare topic',
                search_queries: ['rare topic', 'rare topic survey'],
                required_terms: ['rare', 'topic'],
                support_terms: [],
                required_phrases: ['rare topic'],
                excluded_terms: [],
                screening_hints: {
                  min_anchor_matches: 2,
                  require_support_field_match: true,
                },
              },
            },
          ],
        },
      }
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.screening_status).toBe('degraded')
    expect(output.search_summary.warning_count).toBe(2)
    expect(output.warnings.map((warning: Record<string, unknown>) => warning.code)).toEqual([
      'academic-search-warning',
      'planned-search-no-results',
    ])
  })

  it('paper-screening keeps thesis-style domain anchors and filters off-domain papers', async () => {
    const loaded = await loadAbility('research/paper-screening', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'search-academic', shellEchoJson({
      query: 'integrated supply chain optimization with milp baseline and learning-assisted extensions',
      result_count: 2,
      results: [
        {
          title: 'Efficacy and Safety of Trastuzumab as a Single Agent in First-Line Treatment',
          provider: 'openalex',
          url: 'https://openalex.org/W2115759102',
          snippet: 'Single-agent trastuzumab is active and well tolerated in metastatic breast cancer.',
          metadata: { year: 2002 },
        },
        {
          title: 'Mixed-integer supply chain optimization with integrated production and inventory planning',
          provider: 'openalex',
          url: 'https://openalex.org/W3141592653',
          snippet: 'This supply chain optimization study coordinates production, inventory, and transportation decisions.',
          metadata: { year: 2024 },
        },
      ],
      queries_used: ['supply chain optimization', 'supply chain optimization milp'],
      plan_applied: true,
    }))
    overrideStepRunById(ability as any, 'search-zotero', shellEchoJson({
      query: 'integrated supply chain optimization with milp baseline and learning-assisted extensions',
      result_count: 0,
      items: [],
      queries_used: ['supply chain optimization', 'supply chain optimization milp'],
      plan_applied: true,
    }))

    const execution = await executeAbility(
      ability,
      {
        query: 'integrated supply chain optimization with milp baseline and learning-assisted extensions',
        limit: 10,
      },
      {
        ...createContext(),
        stageOutputs: {
          plan: [
            {
              topic: 'integrated supply chain optimization with milp baseline and learning-assisted extensions',
              search_profile: {
                normalized_focus_query: 'supply chain optimization',
                search_queries: [
                  'supply chain optimization',
                  'supply chain optimization milp',
                ],
                required_terms: ['supply', 'chain', 'optimization'],
                support_terms: ['milp', 'production', 'inventory', 'transportation'],
                required_phrases: ['supply chain'],
                excluded_terms: [],
                screening_hints: {
                  min_anchor_matches: 2,
                  require_support_field_match: true,
                },
              },
            },
          ],
        },
      }
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, any>
    expect(output.items).toHaveLength(1)
    expect(output.items[0].title).toContain('supply chain optimization')
    expect(output.search_summary.filtered_academic_result_count).toBe(1)
    expect(output.search_profile.required_phrases).toEqual(['supply chain'])
  })

  it('paper-fulltext-review fails when zotero-read returns an error payload', async () => {
    const loaded = await loadAbility('research/paper-fulltext-review', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    overrideStepRunById(ability as any, 'read-zotero-pdf', shellEchoJson({
        error: 'No PDF attachment found',
        item_key: 'TEST1234',
      }))

    const execution = await executeAbility(
      ability,
      { zotero_key: 'TEST1234' },
      createContext()
    )

    expect(execution.status).toBe('failed')
    expect(execution.completedSteps.at(-1)?.status).toBe('failed')
    expect(execution.completedSteps.at(-1)?.error).toContain('No PDF attachment found')
  })

  it('paper-fulltext-review retries transient full-text acquisition failures', async () => {
    const loaded = await loadAbility('research/paper-fulltext-review', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    const counterPath = `/tmp/paper-fulltext-review-retry-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    overrideStepRunById(ability as any, 'read-zotero-pdf', `
python3 - <<'PY'
import json
from pathlib import Path

counter_path = Path(${JSON.stringify(counterPath)})
attempt = int(counter_path.read_text()) if counter_path.exists() else 0
attempt += 1
counter_path.write_text(str(attempt), encoding='utf-8')

if attempt == 1:
    raise SystemExit('SSL EOF while reading from Zotero API')

print(json.dumps({
    "item_key": "TESTRETRY",
    "content": "Structured retry content for the reading card.",
    "text_length": 1024,
    "source_excerpt": "Structured retry content excerpt.",
}))
PY`)

    try {
      const execution = await executeAbility(
        ability,
        { zotero_key: 'TESTRETRY' },
        createContext({
          agents: createResearchAgentMock(),
        })
      )

      expect(execution.status).toBe('completed')
      expect(existsSync(counterPath)).toBe(true)
      expect(readFileSync(counterPath, 'utf8')).toBe('2')

      const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, unknown>
      expect(output.paper_key).toBe('TESTRETRY')
      expect(output.summary).toContain('Structured summary for TESTRETRY')
    } finally {
      rmSync(counterPath, { force: true })
    }
  })
})
