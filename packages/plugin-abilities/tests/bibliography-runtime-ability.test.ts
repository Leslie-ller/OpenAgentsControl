import { describe, expect, it } from 'bun:test'
import { resolve } from 'path'
import { loadAbility } from '../src/loader/index.js'
import { executeAbility } from '../src/executor/index.js'
import type { ExecutorContext } from '../src/types/index.js'

function createContext(): ExecutorContext {
  return {
    cwd: process.cwd(),
    env: {},
  }
}

function shellEchoJson(payload: Record<string, unknown>): string {
  return `echo '${JSON.stringify(payload).replace(/'/g, `'\\''`)}'`
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
    ability.steps[0] = {
      ...ability.steps[0],
      run: shellEchoJson({
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
      }),
    }
    ability.steps[1] = {
      ...ability.steps[1],
      run: shellEchoJson({
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
      }),
    }

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
    expect(output.search_summary.academic_result_count).toBe(2)
    expect(output.search_summary.zotero_result_count).toBe(1)
    expect(output.candidate_papers.academic[0].title).toBe('Agent safety benchmark')
    expect(output.candidate_papers.zotero[0].key).toBe('ABCD1234')
  })

  it('paper-fulltext-review derives reading card content from text_preview', async () => {
    const loaded = await loadAbility('research/paper-fulltext-review', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    ability.steps[0] = {
      ...ability.steps[0],
      run: shellEchoJson({
        item_key: 'TEST1234',
        text_preview: 'Preview sentence one. Preview sentence two.',
        text_length: 2048,
        extraction_status: 'ok',
      }),
    }

    const execution = await executeAbility(
      ability,
      { zotero_key: 'TEST1234' },
      createContext()
    )

    expect(execution.status).toBe('completed')
    const output = JSON.parse(execution.completedSteps.at(-1)?.output ?? '{}') as Record<string, unknown>
    expect(output.summary).toBe('Preview sentence one. Preview sentence two.')
    expect(output.sufficiency_score).toBe(0.82)
    expect(output.uncertainty_level).toBe('low')
    expect(output.source_text_length).toBe(2048)
  })

  it('paper-screening filters weak academic matches and keeps stronger evidence', async () => {
    const loaded = await loadAbility('research/paper-screening', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    ability.steps[0] = {
      ...ability.steps[0],
      run: shellEchoJson({
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
      }),
    }
    ability.steps[1] = {
      ...ability.steps[1],
      run: shellEchoJson({
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
      }),
    }

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
    ability.steps[0] = {
      ...ability.steps[0],
      run: shellEchoJson({
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
      }),
    }
    ability.steps[1] = {
      ...ability.steps[1],
      run: shellEchoJson({
        query: 'zzzxxyyqqq unlikely thesis query',
        result_count: 0,
        items: [],
      }),
    }

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
  })

  it('paper-fulltext-review fails when zotero-read returns an error payload', async () => {
    const loaded = await loadAbility('research/paper-fulltext-review', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const ability = structuredClone(loaded!.ability)
    ability.steps[0] = {
      ...ability.steps[0],
      run: shellEchoJson({
        error: 'No PDF attachment found',
        item_key: 'TEST1234',
      }),
    }

    const execution = await executeAbility(
      ability,
      { zotero_key: 'TEST1234' },
      createContext()
    )

    expect(execution.status).toBe('failed')
    expect(execution.completedSteps.at(-1)?.status).toBe('failed')
    expect(execution.completedSteps.at(-1)?.error).toContain('No PDF attachment found')
  })
})
