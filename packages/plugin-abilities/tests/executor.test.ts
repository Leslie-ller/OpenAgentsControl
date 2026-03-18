import { describe, expect, it } from 'bun:test'
import { executeAbility, formatExecutionResult } from '../src/executor/index.js'
import type { Ability, ExecutorContext } from '../src/types/index.js'

const createMockContext = (): ExecutorContext => ({
  cwd: process.cwd(),
  env: {},
})

describe('executeAbility', () => {
  it('should execute a simple script ability', async () => {
    const ability: Ability = {
      name: 'simple',
      description: 'Simple test',
      steps: [
        {
          id: 'echo',
          type: 'script',
          run: 'echo "hello world"',
          validation: {
            exit_code: 0,
          },
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('completed')
    expect(result.completedSteps).toHaveLength(1)
    expect(result.completedSteps[0].status).toBe('completed')
    expect(result.completedSteps[0].output).toContain('hello world')
  })

  it('should execute steps in dependency order', async () => {
    const executionOrder: string[] = []

    const ability: Ability = {
      name: 'ordered',
      description: 'Ordered test',
      steps: [
        {
          id: 'third',
          type: 'script',
          run: 'echo third',
          needs: ['second'],
        },
        {
          id: 'first',
          type: 'script',
          run: 'echo first',
        },
        {
          id: 'second',
          type: 'script',
          run: 'echo second',
          needs: ['first'],
        },
      ],
    }

    const ctx = createMockContext()
    ctx.onStepStart = (step) => executionOrder.push(step.id)

    await executeAbility(ability, {}, ctx)

    expect(executionOrder).toEqual(['first', 'second', 'third'])
  })

  it('should fail on script validation failure', async () => {
    const ability: Ability = {
      name: 'fail',
      description: 'Fail test',
      steps: [
        {
          id: 'fail',
          type: 'script',
          run: 'exit 1',
          validation: {
            exit_code: 0,
          },
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].status).toBe('failed')
  })

  it('should fail on non-zero exit code without explicit validation', async () => {
    const ability: Ability = {
      name: 'fail-default-exit-code',
      description: 'Default exit-code handling test',
      steps: [
        {
          id: 'fail',
          type: 'script',
          run: 'exit 7',
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].status).toBe('failed')
    expect(result.completedSteps[0].error).toContain('Exit code 7')
  })

  it('should validate inputs before execution', async () => {
    const ability: Ability = {
      name: 'with-inputs',
      description: 'Input test',
      inputs: {
        name: {
          type: 'string',
          required: true,
        },
      },
      steps: [
        {
          id: 'greet',
          type: 'script',
          run: 'echo "Hello {{inputs.name}}"',
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('failed')
    expect(result.error).toContain('Input validation failed')
  })

  it('should interpolate variables in script commands', async () => {
    const ability: Ability = {
      name: 'interpolate',
      description: 'Interpolation test',
      inputs: {
        name: {
          type: 'string',
          required: true,
        },
      },
      steps: [
        {
          id: 'greet',
          type: 'script',
          run: 'echo "Hello {{inputs.name}}"',
        },
      ],
    }

    const result = await executeAbility(
      ability,
      { name: 'World' },
      createMockContext()
    )

    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].output).toContain('Hello World')
  })

  it('should expose stage outputs and prior step outputs to script env', async () => {
    const ability: Ability = {
      name: 'context-env',
      description: 'Context env test',
      steps: [
        {
          id: 'generate',
          type: 'script',
          run: 'echo "{\\"value\\":42}"',
        },
        {
          id: 'inspect',
          type: 'script',
          run: [
            "python3 - <<'PY'",
            'import json, os',
            'print(json.dumps({',
            '  "stage_outputs": json.loads(os.environ["ABILITY_STAGE_OUTPUTS_JSON"]),',
            '  "step_outputs": json.loads(os.environ["ABILITY_STEP_OUTPUTS_JSON"]),',
            '}))',
            'PY',
          ].join('\n'),
          needs: ['generate'],
        },
      ],
    }

    const ctx = createMockContext()
    ctx.stageOutputs = { 'reading-card': [{ paper_key: 'p1' }] }
    const result = await executeAbility(ability, {}, ctx)

    expect(result.status).toBe('completed')
    const parsed = JSON.parse(result.completedSteps[1].output || '{}') as Record<string, any>
    expect(parsed.stage_outputs['reading-card'][0].paper_key).toBe('p1')
    expect(parsed.step_outputs.generate.output).toContain('"value":42')
  })

  it('should skip steps when condition is not met', async () => {
    const ability: Ability = {
      name: 'conditional',
      description: 'Conditional test',
      inputs: {
        env: {
          type: 'string',
          required: true,
        },
      },
      steps: [
        {
          id: 'always',
          type: 'script',
          run: 'echo always',
        },
        {
          id: 'prod-only',
          type: 'script',
          run: 'echo production',
          when: 'inputs.env == "production"',
        },
      ],
    }

    const result = await executeAbility(
      ability,
      { env: 'staging' },
      createMockContext()
    )

    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].status).toBe('completed')
    expect(result.completedSteps[1].status).toBe('skipped')
  })

  it('should continue on failure when configured', async () => {
    const ability: Ability = {
      name: 'continue',
      description: 'Continue test',
      steps: [
        {
          id: 'fail',
          type: 'script',
          run: 'exit 1',
          validation: {
            exit_code: 0,
          },
          on_failure: 'continue',
        },
        {
          id: 'after',
          type: 'script',
          run: 'echo after',
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].status).toBe('failed')
    expect(result.completedSteps[1].status).toBe('completed')
  })
})

describe('executeAgentStep', () => {
  it('should execute agent step with context', async () => {
    const ability: Ability = {
      name: 'agent-test',
      description: 'Agent test',
      steps: [
        {
          id: 'review',
          type: 'agent',
          agent: 'reviewer',
          prompt: 'Review this code',
        },
      ],
    }

    const ctx = createMockContext()
    ctx.agents = {
      async call(options) {
        return `Reviewed by ${options.agent}: ${options.prompt}`
      },
      async background(options) {
        return this.call(options)
      }
    }

    const result = await executeAbility(ability, {}, ctx)

    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].status).toBe('completed')
    expect(result.completedSteps[0].output).toContain('Reviewed by reviewer')
  })

  it('should fail agent step without agent context', async () => {
    const ability: Ability = {
      name: 'agent-fail',
      description: 'Agent fail test',
      steps: [
        {
          id: 'review',
          type: 'agent',
          agent: 'reviewer',
          prompt: 'Review this',
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].error).toContain('Agent execution not available')
  })

  it('should pass prior step outputs to agent step', async () => {
    const ability: Ability = {
      name: 'context-pass',
      description: 'Context passing test',
      steps: [
        {
          id: 'generate',
          type: 'script',
          run: 'echo "GENERATED_DATA_123"',
        },
        {
          id: 'review',
          type: 'agent',
          agent: 'reviewer',
          prompt: 'Review the generated data',
          needs: ['generate'],
        },
      ],
    }

    let receivedPrompt = ''
    const ctx = createMockContext()
    ctx.agents = {
      async call(options) {
        receivedPrompt = options.prompt
        return 'Reviewed'
      },
      async background(options) {
        return this.call(options)
      }
    }

    await executeAbility(ability, {}, ctx)

    expect(receivedPrompt).toContain('Context from prior steps')
    expect(receivedPrompt).toContain('generate')
    expect(receivedPrompt).toContain('GENERATED_DATA_123')
  })
})

describe('executeSkillStep', () => {
  it('should execute skill step with context', async () => {
    const ability: Ability = {
      name: 'skill-test',
      description: 'Skill test',
      steps: [
        {
          id: 'docs',
          type: 'skill',
          skill: 'generate-docs',
        },
      ],
    }

    const ctx = createMockContext()
    ctx.skills = {
      async load(name) {
        return `Loaded skill: ${name}`
      }
    }

    const result = await executeAbility(ability, {}, ctx)

    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].output).toContain('generate-docs')
  })

  it('should fail skill step without skill context', async () => {
    const ability: Ability = {
      name: 'skill-fail',
      description: 'Skill fail test',
      steps: [
        {
          id: 'docs',
          type: 'skill',
          skill: 'generate-docs',
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].error).toContain('Skill execution not available')
  })
})

describe('executeApprovalStep', () => {
  it('should execute approval step when approved', async () => {
    const ability: Ability = {
      name: 'approval-test',
      description: 'Approval test',
      steps: [
        {
          id: 'approve',
          type: 'approval',
          prompt: 'Deploy to production?',
        },
      ],
    }

    const ctx = createMockContext()
    ctx.approval = {
      async request() {
        return true
      }
    }

    const result = await executeAbility(ability, {}, ctx)

    expect(result.status).toBe('completed')
    expect(result.completedSteps[0].output).toBe('Approved')
  })

  it('should fail approval step when rejected', async () => {
    const ability: Ability = {
      name: 'approval-reject',
      description: 'Approval reject test',
      steps: [
        {
          id: 'approve',
          type: 'approval',
          prompt: 'Deploy to production?',
        },
      ],
    }

    const ctx = createMockContext()
    ctx.approval = {
      async request() {
        return false
      }
    }

    const result = await executeAbility(ability, {}, ctx)

    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].output).toBe('Rejected')
  })

  it('should fail approval step without approval context', async () => {
    const ability: Ability = {
      name: 'approval-fail',
      description: 'Approval fail test',
      steps: [
        {
          id: 'approve',
          type: 'approval',
          prompt: 'Deploy?',
        },
      ],
    }

    const result = await executeAbility(ability, {}, createMockContext())

    expect(result.status).toBe('failed')
    expect(result.completedSteps[0].error).toContain('Approval not available')
  })

  it('should interpolate variables in approval prompt', async () => {
    const ability: Ability = {
      name: 'approval-vars',
      description: 'Approval vars test',
      inputs: {
        version: { type: 'string', required: true }
      },
      steps: [
        {
          id: 'approve',
          type: 'approval',
          prompt: 'Deploy {{inputs.version}} to production?',
        },
      ],
    }

    let receivedPrompt = ''
    const ctx = createMockContext()
    ctx.approval = {
      async request(options) {
        receivedPrompt = options.prompt
        return true
      }
    }

    await executeAbility(ability, { version: 'v1.2.3' }, ctx)

    expect(receivedPrompt).toBe('Deploy v1.2.3 to production?')
  })
})

describe('formatExecutionResult', () => {
  it('should format completed execution', async () => {
    const ability: Ability = {
      name: 'test',
      description: 'Test',
      steps: [
        { id: 'step1', type: 'script', run: 'echo hello' },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext())
    const formatted = formatExecutionResult(execution)

    expect(formatted).toContain('Ability: test')
    expect(formatted).toContain('✅ Complete')
    expect(formatted).toContain('✅ step1')
  })

  it('should mark code_change summary as partial when control gate warns', async () => {
    const ability: Ability = {
      name: 'code-change-partial-format',
      description: 'Code change with warning gate',
      task_type: 'code_change',
      obligations: [
        { key: 'run_tests', severity: 'hard', tags: ['test'] },
        { key: 'record_validation', severity: 'hard', tags: ['validation'] },
        {
          key: 'verification_evidence_recorded',
          severity: 'hard',
          tags: ['verification-evidence'],
          requiredFields: ['commands', 'results', 'exit_codes'],
        },
        {
          key: 'review_completed',
          severity: 'hard',
          tags: ['review-completed'],
          requiredFields: ['verdict', 'blocking_findings'],
        },
        { key: 'commit_if_required', severity: 'soft', tags: ['commit'] },
      ],
      steps: [
        { id: 'test', type: 'script', run: 'echo test', tags: ['test'] },
        {
          id: 'validate',
          type: 'script',
          run: 'python3 -c "import json; print(json.dumps({\'commands\':[\'bun test\'],\'results\':[\'pass\'],\'exit_codes\':[0]}))"',
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

    const execution = await executeAbility(ability, { task_id: 'task_warn' }, createMockContext())
    const formatted = formatExecutionResult(execution)

    expect(execution.control?.gate.verdict).toBe('warn')
    expect(formatted).toContain('Status: ⚠️ Partial')
    expect(formatted).toContain('Completion Summary:')
  })
})
