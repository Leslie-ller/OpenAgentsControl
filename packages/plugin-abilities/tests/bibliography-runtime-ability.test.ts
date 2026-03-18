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
