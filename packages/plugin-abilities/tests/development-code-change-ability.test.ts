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
  implementationEdits?: Array<{ path: string; content: string }>
}

function createContext(cwd = process.cwd(), options: MockAgentOptions = {}): ExecutorContext {
  const { repairOnValidationFailure = true, implementationEdits = [] } = options
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

        for (const edit of implementationEdits) {
          const target = path.join(cwd, edit.path)
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.writeFile(target, edit.content, 'utf-8')
        }

        return JSON.stringify({
          changed_files: implementationEdits.length > 0
            ? implementationEdits.map((edit) => edit.path)
            : ['packages/plugin-abilities/src/opencode-plugin.ts'],
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

  it('creates a git commit for workflow-managed diffs after review passes', async () => {
    const loaded = await loadAbility('development/code-change', {
      projectDir,
      includeGlobal: false,
    })
    expect(loaded).not.toBeNull()

    const bus = new ControlEventBus()
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'code-change-commit-'))

    try {
      await fs.mkdir(path.join(cwd, 'src'), { recursive: true })
      await fs.writeFile(path.join(cwd, 'src/example.ts'), 'export const value = 1\n', 'utf-8')

      const run = async (args: string[]) => {
        const proc = Bun.spawn({
          cmd: ['git', ...args],
          cwd,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        return {
          exitCode: await proc.exited,
          stdout: await new Response(proc.stdout).text(),
        }
      }

      expect((await run(['init'])).exitCode).toBe(0)
      expect((await run(['config', 'user.name', 'Workflow Test'])).exitCode).toBe(0)
      expect((await run(['config', 'user.email', 'workflow@example.com'])).exitCode).toBe(0)
      expect((await run(['add', 'src/example.ts'])).exitCode).toBe(0)
      expect((await run(['commit', '-m', 'chore: baseline'])).exitCode).toBe(0)

      const execution = await executeAbility(
        loaded!.ability,
        {
          objective: 'Update example export',
          acceptance_criteria: 'example file updated',
          path: 'small',
          affected_files: 'src/example.ts',
          validation_command: "grep -q 'value = 2' src/example.ts",
        },
        createContext(cwd, {
          implementationEdits: [{ path: 'src/example.ts', content: 'export const value = 2\n' }],
        }),
        { eventBus: bus }
      )

      expect(execution.status).toBe('completed')
      expect(execution.completedSteps.some((step) => step.stepId === 'commit' && step.status === 'completed')).toBe(true)

      const head = await run(['log', '-1', '--pretty=%s'])
      expect(head.exitCode).toBe(0)
      expect(head.stdout.trim()).toBe('feat: Update example export')
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
