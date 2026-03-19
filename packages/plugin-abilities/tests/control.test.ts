import { describe, expect, it } from 'bun:test'
import { executeAbility } from '../src/executor/index.js'
import { evaluateControlFromEvents } from '../src/control/index.js'
import { ControlEventFactory, type ControlEvent } from '../src/control/events.js'
import type { Ability, ExecutorContext } from '../src/types/index.js'

const createMockContext = (): ExecutorContext => ({
  cwd: process.cwd(),
  env: {},
})

describe('bibliography control integration', () => {
  const createFactory = (runId = 'run_control_test') => new ControlEventFactory({ run_id: runId })

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

  it('blocks code_change when validation evidence reports failed result', async () => {
    const ability: Ability = {
      name: 'code-change-validation-failed-evidence',
      description: 'Code change with failing validation evidence payload',
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
          run: 'python3 -c "import json; print(json.dumps({\'commands\':[\'npm test\'],\'results\':[\'fail\'],\'exit_codes\':[1]}))"',
          tags: ['validation', 'verification-evidence'],
          needs: ['test'],
        },
        {
          id: 'review',
          type: 'script',
          run: 'python3 -c "import json; print(json.dumps({\'verdict\':\'pass\',\'blocking_findings\':[]}))"',
          tags: ['review-completed'],
          needs: ['validate'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext())

    expect(execution.status).toBe('failed')
    expect(execution.control?.gate.verdict).toBe('block')
    expect(execution.control?.gates?.some((g) => g.name === 'validation_gate' && g.verdict === 'block')).toBe(true)
  })

  it('blocks code_change when review evidence includes blocking findings', async () => {
    const ability: Ability = {
      name: 'code-change-review-blocking-findings',
      description: 'Code change with blocking review findings',
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
          run: 'python3 -c "import json; print(json.dumps({\'commands\':[\'npm test\'],\'results\':[\'pass\'],\'exit_codes\':[0]}))"',
          tags: ['validation', 'verification-evidence'],
          needs: ['test'],
        },
        {
          id: 'review',
          type: 'script',
          run: 'python3 -c "import json; print(json.dumps({\'verdict\':\'pass\',\'blocking_findings\':[\'Race condition in cache\']}))"',
          tags: ['review-completed'],
          needs: ['validate'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext())

    expect(execution.status).toBe('failed')
    expect(execution.control?.gate.verdict).toBe('block')
    expect(execution.control?.gates?.some((g) => g.name === 'review_gate' && g.verdict === 'block')).toBe(true)
  })

  it('blocks code_change on subtask dependency violations from evidence stats', () => {
    const ability: Ability = {
      name: 'code-change-subtask-dependency-violation',
      description: 'Code change complex path dependency violation',
      task_type: 'code_change',
      obligations: [
        { key: 'run_tests', severity: 'hard', tags: ['test'] },
        { key: 'record_validation', severity: 'hard', tags: ['validation'] },
        {
          key: 'verification_evidence_recorded',
          severity: 'hard',
          tags: ['verification-evidence'],
          requiredFields: ['commands', 'exit_codes', 'results'],
        },
        {
          key: 'review_completed',
          severity: 'hard',
          tags: ['review-completed'],
          requiredFields: ['verdict', 'blocking_findings'],
        },
      ],
      steps: [],
    }

    const factory = createFactory('run_subtask_gate')
    const events: ControlEvent[] = [
      factory.stepCompleted('code-change-subtask-dependency-violation', 'test', 'script', 'completed', 5, {
        tags: ['test'],
      }),
      factory.stepCompleted('code-change-subtask-dependency-violation', 'validate', 'script', 'completed', 5, {
        tags: ['validation', 'verification-evidence'],
      }),
      factory.stepCompleted('code-change-subtask-dependency-violation', 'review', 'script', 'completed', 5, {
        tags: ['review-completed'],
      }),
      factory.evidenceStats('code-change-subtask-dependency-violation', {
        commands: ['bun test'],
        results: ['pass'],
        exit_codes: [0],
        verdict: 'pass',
        blocking_findings: [],
        dependency_violations: ['subtask_2 depends on subtask_1'],
      }),
    ]

    const result = evaluateControlFromEvents(ability, events)
    expect(result).not.toBeUndefined()
    expect(result!.gate.verdict).toBe('block')
    expect(result!.gates?.some((g) => g.name === 'subtask_dependency_gate' && g.verdict === 'block')).toBe(true)
  })

  it('forces code_change gates for development/code-change even without new-workflow activation evidence', async () => {
    const ability: Ability = {
      name: 'development/code-change',
      description: 'High-level code change workflow',
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

    expect(execution.status).toBe('failed')
    expect(execution.control?.gate.verdict).toBe('block')
    expect(execution.control?.gates?.some((g) => g.name === 'review_gate' && g.verdict === 'block')).toBe(true)
    expect(execution.control?.gates?.some((g) => g.name === 'completion_claim_gate' && g.verdict === 'block')).toBe(true)
  })
})
