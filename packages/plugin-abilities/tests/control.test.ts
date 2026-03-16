import { describe, expect, it } from 'bun:test'
import { executeAbility } from '../src/executor/index.js'
import type { Ability, ExecutorContext } from '../src/types/index.js'

const createMockContext = (): ExecutorContext => ({
  cwd: process.cwd(),
  env: {},
})

describe('bibliography control integration', () => {
  it('blocks paper_fulltext_review when required obligations are missing', async () => {
    const ability: Ability = {
      name: 'paper-review-missing-obligations',
      description: 'Review ability missing artifact steps',
      task_type: 'paper_fulltext_review',
      steps: [
        {
          id: 'prepare',
          type: 'script',
          run: 'echo prepare',
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext())

    expect(execution.executionStatus).toBe('completed')
    expect(execution.status).toBe('failed')
    expect(execution.control?.gate.verdict).toBe('block')
    expect(execution.control?.obligations.find((item) => item.key === 'extract_fulltext')?.status).toBe('missing')
    expect(execution.control?.obligations.find((item) => item.key === 'record_reading_card')?.status).toBe('missing')
  })

  it('allows paper_fulltext_review when extract and reading-card obligations are satisfied', async () => {
    const ability: Ability = {
      name: 'paper-review-complete',
      description: 'Review ability with required evidence',
      task_type: 'paper_fulltext_review',
      steps: [
        {
          id: 'extract',
          type: 'script',
          run: 'echo extract',
          tags: ['fulltext-extract'],
        },
        {
          id: 'card',
          type: 'script',
          run: 'echo card',
          tags: ['reading-card'],
          needs: ['extract'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext())

    expect(execution.executionStatus).toBe('completed')
    expect(execution.status).toBe('completed')
    expect(execution.control?.gate.verdict).toBe('allow')
  })

  it('warns on missing soft obligation for code_change', async () => {
    const ability: Ability = {
      name: 'code-change-soft-warning',
      description: 'Code change without commit evidence',
      task_type: 'code_change',
      steps: [
        {
          id: 'test',
          type: 'script',
          run: 'echo test',
          tags: ['test'],
        },
        {
          id: 'validate',
          type: 'script',
          run: 'echo validate',
          tags: ['validation'],
          needs: ['test'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext())

    expect(execution.status).toBe('completed')
    expect(execution.control?.gate.verdict).toBe('warn')
    expect(execution.control?.gate.warnings).toContain('Missing soft obligation: commit_if_required')
  })
})
