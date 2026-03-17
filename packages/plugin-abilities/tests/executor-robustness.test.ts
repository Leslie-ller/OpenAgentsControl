import { describe, expect, it } from 'bun:test'
import { executeAbility, parseTimeout } from '../src/executor/index.js'
import type { Ability, ExecutorContext } from '../src/types/index.js'

const createMockContext = (): ExecutorContext => ({
  cwd: process.cwd(),
  env: {},
})

// ─────────────────────────────────────────────────────────────
// parseTimeout
// ─────────────────────────────────────────────────────────────

describe('parseTimeout', () => {
  it('should parse seconds', () => {
    expect(parseTimeout('30s')).toBe(30000)
  })

  it('should parse minutes', () => {
    expect(parseTimeout('5m')).toBe(300000)
  })

  it('should parse hours', () => {
    expect(parseTimeout('1h')).toBe(3600000)
  })

  it('should parse milliseconds', () => {
    expect(parseTimeout('500ms')).toBe(500)
  })

  it('should parse combined format', () => {
    expect(parseTimeout('2m30s')).toBe(150000)
  })

  it('should parse plain number as ms', () => {
    expect(parseTimeout('5000')).toBe(5000)
  })

  it('should return undefined for undefined input', () => {
    expect(parseTimeout(undefined)).toBeUndefined()
  })

  it('should return undefined for empty string', () => {
    expect(parseTimeout('')).toBeUndefined()
  })

  it('should return undefined for unparseable string', () => {
    expect(parseTimeout('abc')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// Step Timeout
// ─────────────────────────────────────────────────────────────

describe('step timeout', () => {
  it('should complete within timeout', async () => {
    const ability: Ability = {
      name: 'fast',
      description: 'Fast step',
      steps: [{
        id: 'quick',
        type: 'script',
        run: 'echo fast',
        timeout: '10s',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].status).toBe('completed')
  })

  it('should fail when step exceeds timeout', async () => {
    const ability: Ability = {
      name: 'slow',
      description: 'Slow step',
      steps: [{
        id: 'hanging',
        type: 'script',
        run: 'sleep 10',
        timeout: '200ms',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].status).toBe('failed')
    expect(result.completedSteps[0].error).toContain('timed out')
  })

  it('should use ability-level settings.timeout as fallback', async () => {
    const ability: Ability = {
      name: 'ability-timeout',
      description: 'Ability-level timeout',
      settings: { timeout: '200ms' },
      steps: [{
        id: 'hanging',
        type: 'script',
        run: 'sleep 10',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].error).toContain('timed out')
  })

  it('should prefer step timeout over ability timeout', async () => {
    const ability: Ability = {
      name: 'override',
      description: 'Step overrides ability timeout',
      settings: { timeout: '100ms' },
      steps: [{
        id: 'fast-override',
        type: 'script',
        run: 'echo done',
        timeout: '10s',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('completed')
  })
})

// ─────────────────────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────────────────────

describe('on_failure: retry', () => {
  it('should retry a failing step up to max_retries', async () => {
    let attempts = 0
    const ability: Ability = {
      name: 'retry-test',
      description: 'Retry test',
      steps: [{
        id: 'flaky',
        type: 'agent',
        agent: 'test-agent',
        prompt: 'do something',
        on_failure: 'retry',
        max_retries: 2,
      }],
    }

    const ctx = createMockContext()
    ctx.agents = {
      call: async () => {
        attempts++
        if (attempts < 3) throw new Error('transient failure')
        return 'success on attempt 3'
      },
    }

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].output).toBe('success on attempt 3')
    expect(attempts).toBe(3)
  })

  it('should fail after exhausting all retries', async () => {
    let attempts = 0
    const ability: Ability = {
      name: 'retry-fail',
      description: 'Retry exhaustion',
      steps: [{
        id: 'always-fail',
        type: 'agent',
        agent: 'test-agent',
        prompt: 'always fails',
        on_failure: 'retry',
        max_retries: 2,
      }],
    }

    const ctx = createMockContext()
    ctx.agents = {
      call: async () => {
        attempts++
        throw new Error('permanent failure')
      },
    }

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('failed')
    expect(attempts).toBe(3) // 1 initial + 2 retries
  })

  it('should not retry when on_failure is stop', async () => {
    let attempts = 0
    const ability: Ability = {
      name: 'no-retry',
      description: 'No retry',
      steps: [{
        id: 'fail-once',
        type: 'script',
        run: 'exit 1',
        validation: { exit_code: 0 },
        on_failure: 'stop',
        max_retries: 5, // should be ignored
      }],
    }

    const ctx = createMockContext()
    ctx.onStepStart = () => { attempts++ }

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('failed')
    expect(attempts).toBe(1) // no retries
  })

  it('should default max_retries to 1 when retry is set but no max_retries', async () => {
    let attempts = 0
    const ability: Ability = {
      name: 'retry-default',
      description: 'Default retry count',
      steps: [{
        id: 'fail-retry',
        type: 'agent',
        agent: 'test-agent',
        prompt: 'fails',
        on_failure: 'retry',
        // no max_retries specified — should default to at least 1 retry
      }],
    }

    const ctx = createMockContext()
    ctx.agents = {
      call: async () => {
        attempts++
        throw new Error('always fails')
      },
    }

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('failed')
    expect(attempts).toBe(2) // 1 initial + 1 retry (Math.max(0, 1) + 1 = 2)
  })
})

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

describe('hooks', () => {
  it('should run before hooks before step execution', async () => {
    const events: string[] = []

    const ability: Ability = {
      name: 'with-hooks',
      description: 'Hooks test',
      hooks: {
        before: ['echo BEFORE'],
      },
      steps: [{
        id: 'main',
        type: 'script',
        run: 'echo MAIN',
      }],
    }

    const ctx = createMockContext()
    ctx.onStepStart = () => events.push('step-start')

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('completed')
  })

  it('should fail ability when before hook fails', async () => {
    const ability: Ability = {
      name: 'bad-before',
      description: 'Before hook failure',
      hooks: {
        before: ['exit 1'],
      },
      steps: [{
        id: 'main',
        type: 'script',
        run: 'echo should-not-run',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('failed')
    expect(result.error).toContain('before hook failed')
    expect(result.completedSteps).toHaveLength(0) // no steps should have run
  })

  it('should run after hooks after all steps complete', async () => {
    const ability: Ability = {
      name: 'after-hooks',
      description: 'After hooks test',
      hooks: {
        after: ['echo AFTER'],
      },
      steps: [{
        id: 'main',
        type: 'script',
        run: 'echo MAIN',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('completed')
  })

  it('should not fail ability when after hook fails (best-effort)', async () => {
    const ability: Ability = {
      name: 'bad-after',
      description: 'After hook failure — best effort',
      hooks: {
        after: ['exit 1'],
      },
      steps: [{
        id: 'main',
        type: 'script',
        run: 'echo done',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    // After hooks are best-effort — ability should still be completed
    expect(result.status).toBe('completed')
  })

  it('should run multiple before hooks sequentially', async () => {
    const ability: Ability = {
      name: 'multi-hooks',
      description: 'Multiple hooks',
      hooks: {
        before: ['echo first', 'echo second'],
      },
      steps: [{
        id: 'main',
        type: 'script',
        run: 'echo main',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('completed')
  })

  it('should stop before hooks on first failure', async () => {
    const ability: Ability = {
      name: 'hook-stop',
      description: 'Hook stops on failure',
      hooks: {
        before: ['exit 1', 'echo should-not-run'],
      },
      steps: [{
        id: 'main',
        type: 'script',
        run: 'echo should-not-run',
      }],
    }

    const result = await executeAbility(ability, {}, createMockContext())
    expect(result.status).toBe('failed')
    expect(result.completedSteps).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────
// Skill Step Inputs
// ─────────────────────────────────────────────────────────────

describe('skill step inputs', () => {
  it('should forward inputs to skill load', async () => {
    let receivedInputs: Record<string, unknown> | undefined

    const ability: Ability = {
      name: 'skill-inputs',
      description: 'Skill with inputs',
      steps: [{
        id: 'load-skill',
        type: 'skill',
        skill: 'data-processor',
        inputs: { format: 'json', limit: 100 },
      }],
    }

    const ctx = createMockContext()
    ctx.skills = {
      load: async (name: string, inputs?: Record<string, unknown>) => {
        receivedInputs = inputs
        return `loaded ${name}`
      },
    }

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('completed')
    expect(receivedInputs).toEqual({ format: 'json', limit: 100 })
    expect(result.completedSteps[0].output).toBe('loaded data-processor')
  })

  it('should work without inputs (backward compatible)', async () => {
    let receivedInputs: Record<string, unknown> | undefined

    const ability: Ability = {
      name: 'skill-no-inputs',
      description: 'Skill without inputs',
      steps: [{
        id: 'load-skill',
        type: 'skill',
        skill: 'simple-skill',
      }],
    }

    const ctx = createMockContext()
    ctx.skills = {
      load: async (name: string, inputs?: Record<string, unknown>) => {
        receivedInputs = inputs
        return `loaded ${name}`
      },
    }

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('completed')
    expect(receivedInputs).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// on_failure: 'continue' for all step types
// ─────────────────────────────────────────────────────────────

describe('on_failure: continue for non-script steps', () => {
  it('should continue past a failed agent step with on_failure: continue', async () => {
    const ability: Ability = {
      name: 'agent-continue',
      description: 'Agent continue on failure',
      steps: [
        {
          id: 'fail-agent',
          type: 'agent',
          agent: 'broken',
          prompt: 'will fail',
          on_failure: 'continue',
        },
        {
          id: 'after',
          type: 'script',
          run: 'echo survived',
        },
      ],
    }

    const ctx = createMockContext()
    // No agents context → agent step will fail

    const result = await executeAbility(ability, {}, ctx)
    expect(result.completedSteps).toHaveLength(2)
    expect(result.completedSteps[0].status).toBe('failed')
    expect(result.completedSteps[1].status).toBe('completed')
    expect(result.completedSteps[1].output).toContain('survived')
  })
})

// ─────────────────────────────────────────────────────────────
// Timeout + Retry Combination
// ─────────────────────────────────────────────────────────────

describe('timeout + retry combination', () => {
  it('should retry on timeout when on_failure is retry', async () => {
    let attempts = 0

    const ability: Ability = {
      name: 'timeout-retry',
      description: 'Timeout with retry',
      steps: [{
        id: 'flaky-timeout',
        type: 'agent',
        agent: 'slow-agent',
        prompt: 'do something',
        timeout: '200ms',
        on_failure: 'retry',
        max_retries: 2,
      }],
    }

    const ctx = createMockContext()
    ctx.agents = {
      call: async () => {
        attempts++
        if (attempts < 3) {
          // Simulate slow response on first 2 attempts
          await new Promise(r => setTimeout(r, 500))
          return 'too slow'
        }
        return 'fast enough'
      },
    }

    const result = await executeAbility(ability, {}, ctx)
    expect(result.status).toBe('completed')
    expect(attempts).toBe(3)
    expect(result.completedSteps[0].output).toBe('fast enough')
  })
})
