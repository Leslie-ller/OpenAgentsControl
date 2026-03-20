import { describe, it, expect } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import { resolve } from 'path'
import * as path from 'path'
import { loadAbility } from '../src/loader/index.js'
import { executeAbility } from '../src/executor/index.js'
import { ControlEventBus } from '../src/control/event-bus.js'
import type { ExecutorContext } from '../src/types/index.js'

interface MockAgentOptions {
  repairOnValidationFailure?: boolean
}

function createContext(cwd = process.cwd(), options: MockAgentOptions = {}): ExecutorContext {
  const { repairOnValidationFailure = true } = options
  return {
    cwd,
    env: {},
    agents: {
      async call({ prompt }) {
        if (prompt.includes('The previous validation step failed') && repairOnValidationFailure) {
          await fs.writeFile(path.join(cwd, 'repair.marker'), 'ok', 'utf-8')
          return JSON.stringify({
            changed_files: ['packages/plugin-abilities/src/opencode-plugin.ts'],
            implementation_summary: 'Applied repair after validation failure',
            deliverables_completed: ['implementation', 'repair'],
          })
        }

        return JSON.stringify({
          changed_files: ['packages/plugin-abilities/src/opencode-plugin.ts'],
          implementation_summary: 'Applied requested implementation changes',
          deliverables_completed: ['implementation'],
        })
      },
    },
  }
}

describe('development/code-change ability', () => {
  const projectDir = resolve(import.meta.dir, '..', '..', '..', '.opencode', 'abilities')

  it('loads development/code-change ability from repository abilities', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })

    expect(loaded).not.toBeNull()
    expect(loaded!.ability.task_type).toBe('code_change')
    expect(loaded!.ability.steps.length).toBeGreaterThan(0)
  })

  it('runs small path and satisfies hard obligations', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const bus = new ControlEventBus()
    const execution = await executeAbility(
      loaded!.ability,
      {
        objective: 'Implement API handler update',
        acceptance_criteria: 'handler returns 200;adds validation',
        path: 'small',
        affected_files: 'src/api/handler.ts,src/api/types.ts',
        validation_command: 'echo validation_ok',
      },
      createContext(),
      { eventBus: bus }
    )

    expect(execution.status).toBe('completed')
    expect(execution.control?.gate.verdict).toBe('allow')
    expect(execution.control?.obligations.filter((ob) => ob.severity === 'hard').every((ob) => ob.status === 'satisfied')).toBe(true)
  })

  it('runs complex path and satisfies hard obligations', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const bus = new ControlEventBus()
    const execution = await executeAbility(
      loaded!.ability,
      {
        objective: 'Refactor multi-file workflow',
        acceptance_criteria: 'all tests pass;complex path covered',
        path: 'complex',
        affected_files: 'src/a.ts,src/b.ts,src/c.ts,src/d.ts',
        validation_command: 'echo validation_ok',
      },
      createContext(),
      { eventBus: bus }
    )

    expect(execution.status).toBe('completed')
    expect(execution.control?.gate.verdict).toBe('allow')
    expect(execution.completedSteps.some((step) => step.stepId === 'plan-complex-subtasks' && step.status === 'completed')).toBe(true)
  })

  it('blocks completion when validation still fails after repair attempt', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const bus = new ControlEventBus()
    const execution = await executeAbility(
      loaded!.ability,
      {
        objective: 'Implement API handler update',
        acceptance_criteria: 'handler returns 200;adds validation',
        path: 'small',
        affected_files: 'src/api/handler.ts,src/api/types.ts',
        validation_command: 'exit 1',
      },
      createContext(process.cwd(), { repairOnValidationFailure: false }),
      { eventBus: bus }
    )

    expect(execution.status).toBe('failed')
    expect(execution.completedSteps.some((step) => step.stepId === 'repair-after-validate' && step.status === 'completed')).toBe(true)
    expect(execution.completedSteps.some((step) => step.stepId === 'validate-after-repair' && step.status === 'failed')).toBe(true)
    expect(execution.completedSteps.some((step) => step.stepId === 'validation-gate' && step.status === 'failed')).toBe(true)
    expect(execution.error).toContain('Validation did not pass')
  })

  it('repairs after validation failure and reruns validation inside the workflow', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const bus = new ControlEventBus()
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'code-change-repair-'))

    try {
      const execution = await executeAbility(
        loaded!.ability,
        {
          objective: 'Implement dispatch normalization',
          acceptance_criteria: 'validation eventually passes',
          path: 'small',
          affected_files: 'packages/plugin-abilities/src/opencode-plugin.ts',
          validation_command: 'test -f repair.marker',
        },
        createContext(cwd),
        { eventBus: bus }
      )

      expect(execution.status).toBe('completed')
      expect(execution.completedSteps.some((step) => step.stepId === 'validate' && step.status === 'failed')).toBe(true)
      expect(execution.completedSteps.some((step) => step.stepId === 'repair-after-validate' && step.status === 'completed')).toBe(true)
      expect(execution.completedSteps.some((step) => step.stepId === 'validate-after-repair' && step.status === 'completed')).toBe(true)
      expect(execution.control?.gate.verdict).toBe('allow')
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('blocks completion when review has blocking findings', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const bus = new ControlEventBus()
    const execution = await executeAbility(
      loaded!.ability,
      {
        objective: 'Implement API handler update',
        acceptance_criteria: 'handler returns 200;adds validation',
        path: 'small',
        affected_files: 'src/api/handler.ts,src/api/types.ts',
        validation_command: 'echo validation_ok',
        review_verdict: 'pass',
        review_blocking_findings: 'Null pointer risk in parser',
      },
      createContext(),
      { eventBus: bus }
    )

    expect(execution.status).toBe('failed')
    expect(execution.control?.gate.verdict).toBe('block')
    expect(execution.control?.gates?.some((gate) => gate.name === 'review_gate' && gate.verdict === 'block')).toBe(true)
  })

  it('blocks completion for complex path when dependency violations are reported', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const bus = new ControlEventBus()
    const execution = await executeAbility(
      loaded!.ability,
      {
        objective: 'Refactor multi-file workflow',
        acceptance_criteria: 'all tests pass;complex path covered',
        path: 'complex',
        affected_files: 'src/a.ts,src/b.ts,src/c.ts,src/d.ts',
        validation_command: 'echo validation_ok',
        dependency_violations: 'subtask_2 depends on subtask_1',
      },
      createContext(),
      { eventBus: bus }
    )

    expect(execution.status).toBe('failed')
    expect(execution.control?.gate.verdict).toBe('block')
    expect(execution.control?.gates?.some((gate) => gate.name === 'subtask_dependency_gate' && gate.verdict === 'block')).toBe(true)
  })
})
