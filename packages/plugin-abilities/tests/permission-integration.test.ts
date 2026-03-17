import { describe, expect, it } from 'bun:test'
import { executeAbility } from '../src/executor/index.js'
import { PermissionValidator } from '../src/validator/permissions.js'
import type { Ability, ExecutorContext, StepResult } from '../src/types/index.js'
import type { AgentPermissions } from '../src/context/types.js'

/**
 * Integration tests: PermissionValidator wired into the executor pipeline.
 *
 * These tests verify that when permissionValidator + agentPermissions are
 * provided in the ExecutorContext, the executor correctly blocks or allows
 * steps based on the permission rules.
 */

const validator = new PermissionValidator()

function baseCtx(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    cwd: process.cwd(),
    env: {},
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// Abilities used by the tests
// ─────────────────────────────────────────────────────────────

const singleScriptAbility: Ability = {
  name: 'deploy',
  description: 'Deploy app',
  steps: [
    { id: 'build', type: 'script', run: 'echo building' },
  ],
}

const multiStepAbility: Ability = {
  name: 'release',
  description: 'Release pipeline',
  steps: [
    { id: 'test', type: 'script', run: 'echo test' },
    { id: 'lint', type: 'script', run: 'echo lint' },
    { id: 'deploy', type: 'script', run: 'echo deploy' },
  ],
}

const agentAbility: Ability = {
  name: 'research',
  description: 'Research task',
  steps: [
    { id: 'ask', type: 'agent', agent: 'researcher', prompt: 'Find info' },
  ],
}

const mixedAbility: Ability = {
  name: 'mixed-pipeline',
  description: 'Mixed step types',
  steps: [
    { id: 'build', type: 'script', run: 'echo build' },
    { id: 'review', type: 'agent', agent: 'reviewer', prompt: 'Review code' },
    { id: 'approve', type: 'approval', prompt: 'Approve release?' },
  ],
}

const workflowAbility: Ability = {
  name: 'orchestrate',
  description: 'Orchestration',
  steps: [
    { id: 'run-sub', type: 'workflow', workflow: 'sub-pipeline' },
  ],
}

const skillAbility: Ability = {
  name: 'use-skill',
  description: 'Skill usage',
  steps: [
    { id: 'load-skill', type: 'skill', skill: 'web-search' },
  ],
}

const continueOnFailAbility: Ability = {
  name: 'resilient',
  description: 'Continues past permission denial',
  steps: [
    { id: 'denied-step', type: 'script', run: 'echo denied', on_failure: 'continue' } as any,
    { id: 'allowed-step', type: 'script', run: 'echo allowed' },
  ],
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('Executor permission integration', () => {

  describe('without permissions (opt-in model)', () => {
    it('executes all steps when no permissionValidator is configured', async () => {
      const result = await executeAbility(singleScriptAbility, {}, baseCtx())
      expect(result.status).toBe('completed')
      expect(result.completedSteps).toHaveLength(1)
      expect(result.completedSteps[0].status).toBe('completed')
    })

    it('executes all steps when permissionValidator exists but no agentPermissions', async () => {
      const ctx = baseCtx({ permissionValidator: validator })
      const result = await executeAbility(singleScriptAbility, {}, ctx)
      expect(result.status).toBe('completed')
    })

    it('executes all steps when agentPermissions exists but no permissionValidator', async () => {
      const ctx = baseCtx({
        agentPermissions: { agent: 'test', permissions: [] },
      })
      const result = await executeAbility(singleScriptAbility, {}, ctx)
      expect(result.status).toBe('completed')
    })
  })

  describe('script step permissions', () => {
    it('allows a script step when agent has permission for it', async () => {
      const perms: AgentPermissions = {
        agent: 'deployer',
        permissions: [{ skill: 'script', tools: ['build'] }],
      }
      const ctx = baseCtx({ permissionValidator: validator, agentPermissions: perms })
      const result = await executeAbility(singleScriptAbility, {}, ctx)
      expect(result.status).toBe('completed')
      expect(result.completedSteps[0].status).toBe('completed')
    })

    it('allows a script step when agent has wildcard script permission', async () => {
      const perms: AgentPermissions = {
        agent: 'admin',
        permissions: [{ skill: 'script', tools: ['*'] }],
      }
      const ctx = baseCtx({ permissionValidator: validator, agentPermissions: perms })
      const result = await executeAbility(multiStepAbility, {}, ctx)
      expect(result.status).toBe('completed')
      expect(result.completedSteps).toHaveLength(3)
    })

    it('blocks a script step when agent lacks permission', async () => {
      const perms: AgentPermissions = {
        agent: 'reader',
        permissions: [{ skill: 'script', tools: ['read-only'] }],
      }
      const ctx = baseCtx({ permissionValidator: validator, agentPermissions: perms })
      const result = await executeAbility(singleScriptAbility, {}, ctx)
      expect(result.status).toBe('failed')
      expect(result.completedSteps[0].status).toBe('failed')
      expect(result.completedSteps[0].error).toContain('permission')
      expect(result.completedSteps[0].error).toContain('build')
    })

    it('blocks at the first denied step in a multi-step pipeline', async () => {
      // Allow 'test' and 'lint' but not 'deploy'
      const perms: AgentPermissions = {
        agent: 'dev',
        permissions: [{ skill: 'script', tools: ['test', 'lint'] }],
      }
      const ctx = baseCtx({ permissionValidator: validator, agentPermissions: perms })
      const result = await executeAbility(multiStepAbility, {}, ctx)
      expect(result.status).toBe('failed')
      // test and lint should have completed, deploy should have failed
      expect(result.completedSteps).toHaveLength(3)
      expect(result.completedSteps[0].status).toBe('completed')
      expect(result.completedSteps[1].status).toBe('completed')
      expect(result.completedSteps[2].status).toBe('failed')
      expect(result.completedSteps[2].error).toContain('deploy')
    })

    it('blocks with no script permissions at all', async () => {
      const perms: AgentPermissions = {
        agent: 'no-script',
        permissions: [{ skill: 'agent', tools: ['*'] }],
      }
      const ctx = baseCtx({ permissionValidator: validator, agentPermissions: perms })
      const result = await executeAbility(singleScriptAbility, {}, ctx)
      expect(result.status).toBe('failed')
      expect(result.error).toContain('permission')
    })
  })

  describe('agent step permissions', () => {
    it('allows agent step when agent permission includes the target agent', async () => {
      const perms: AgentPermissions = {
        agent: 'orchestrator',
        permissions: [{ skill: 'agent', tools: ['researcher'] }],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        agents: { call: async () => 'research result' },
      })
      const result = await executeAbility(agentAbility, {}, ctx)
      expect(result.status).toBe('completed')
    })

    it('blocks agent step when agent permission lacks the target agent', async () => {
      const perms: AgentPermissions = {
        agent: 'restricted',
        permissions: [{ skill: 'agent', tools: ['writer'] }],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        agents: { call: async () => 'should not reach' },
      })
      const result = await executeAbility(agentAbility, {}, ctx)
      expect(result.status).toBe('failed')
      expect(result.error).toContain('researcher')
    })
  })

  describe('approval step permissions', () => {
    it('always allows approval steps (safety mechanism, not a privilege)', async () => {
      const approvalAbility: Ability = {
        name: 'approve-only',
        description: 'Approval test',
        steps: [
          { id: 'gate', type: 'approval', prompt: 'OK?' },
        ],
      }
      // Agent has NO permissions at all
      const perms: AgentPermissions = { agent: 'nobody', permissions: [] }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        approval: { request: async () => true },
      })
      const result = await executeAbility(approvalAbility, {}, ctx)
      expect(result.status).toBe('completed')
      expect(result.completedSteps[0].status).toBe('completed')
    })
  })

  describe('workflow step permissions', () => {
    it('blocks workflow step when agent lacks workflow permission', async () => {
      const perms: AgentPermissions = {
        agent: 'basic',
        permissions: [{ skill: 'script', tools: ['*'] }],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        abilities: {
          get: () => undefined,
          execute: async () => ({ status: 'completed' } as any),
        },
      })
      const result = await executeAbility(workflowAbility, {}, ctx)
      expect(result.status).toBe('failed')
      expect(result.error).toContain('workflow')
    })

    it('allows workflow step when agent has workflow permission', async () => {
      const perms: AgentPermissions = {
        agent: 'admin',
        permissions: [{ skill: 'workflow', tools: ['sub-pipeline'] }],
      }
      const subAbility: Ability = {
        name: 'sub-pipeline',
        description: 'Sub',
        steps: [{ id: 's1', type: 'script', run: 'echo sub' }],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        abilities: {
          get: (name: string) => name === 'sub-pipeline' ? subAbility : undefined,
          execute: async (ability) => ({
            id: 'child',
            ability,
            inputs: {},
            status: 'completed' as const,
            currentStep: null,
            currentStepIndex: -1,
            completedSteps: [],
            pendingSteps: [],
            startedAt: Date.now(),
            completedAt: Date.now(),
          }),
        },
      })
      const result = await executeAbility(workflowAbility, {}, ctx)
      expect(result.status).toBe('completed')
    })
  })

  describe('skill step permissions', () => {
    it('blocks skill step when agent lacks skill permission', async () => {
      const perms: AgentPermissions = {
        agent: 'limited',
        permissions: [{ skill: 'file-ops', tools: ['read'] }],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        skills: { load: async () => 'loaded' },
      })
      const result = await executeAbility(skillAbility, {}, ctx)
      expect(result.status).toBe('failed')
      expect(result.error).toContain('web-search')
    })

    it('allows skill step when agent has matching skill permission', async () => {
      const perms: AgentPermissions = {
        agent: 'searcher',
        permissions: [{ skill: 'web-search', tools: ['*'] }],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        skills: { load: async () => 'search results' },
      })
      const result = await executeAbility(skillAbility, {}, ctx)
      expect(result.status).toBe('completed')
    })
  })

  describe('mixed step type pipeline', () => {
    it('allows all steps when agent has full permissions', async () => {
      const perms: AgentPermissions = {
        agent: 'superuser',
        permissions: [
          { skill: 'script', tools: ['*'] },
          { skill: 'agent', tools: ['*'] },
        ],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        agents: { call: async () => 'reviewed' },
        approval: { request: async () => true },
      })
      const result = await executeAbility(mixedAbility, {}, ctx)
      expect(result.status).toBe('completed')
      expect(result.completedSteps).toHaveLength(3)
    })

    it('blocks at agent step when script is allowed but agent is not', async () => {
      const perms: AgentPermissions = {
        agent: 'builder',
        permissions: [{ skill: 'script', tools: ['*'] }],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        agents: { call: async () => 'should not reach' },
        approval: { request: async () => true },
      })
      const result = await executeAbility(mixedAbility, {}, ctx)
      expect(result.status).toBe('failed')
      // build step (script) should succeed, review step (agent) should fail
      expect(result.completedSteps[0].stepId).toBe('build')
      expect(result.completedSteps[0].status).toBe('completed')
      expect(result.completedSteps[1].stepId).toBe('review')
      expect(result.completedSteps[1].status).toBe('failed')
      expect(result.completedSteps[1].error).toContain('reviewer')
    })
  })

  describe('on_failure: continue with permission denial', () => {
    it('continues past a permission-denied step when on_failure is continue', async () => {
      // denied-step has on_failure: 'continue' but no script permission
      // allowed-step has script permission
      const perms: AgentPermissions = {
        agent: 'partial',
        permissions: [{ skill: 'script', tools: ['allowed-step'] }],
      }
      const ctx = baseCtx({ permissionValidator: validator, agentPermissions: perms })
      const result = await executeAbility(continueOnFailAbility, {}, ctx)
      // The first step is denied but continues; the second step is allowed
      expect(result.status).toBe('completed')
      expect(result.completedSteps).toHaveLength(2)
      expect(result.completedSteps[0].stepId).toBe('denied-step')
      expect(result.completedSteps[0].status).toBe('failed')
      expect(result.completedSteps[0].error).toContain('permission')
      expect(result.completedSteps[1].stepId).toBe('allowed-step')
      expect(result.completedSteps[1].status).toBe('completed')
    })
  })

  describe('callbacks fire on permission denial', () => {
    it('fires onStepStart and onStepFail for denied steps', async () => {
      const started: string[] = []
      const failed: Array<{ stepId: string; error: string }> = []

      const perms: AgentPermissions = {
        agent: 'nobody',
        permissions: [],
      }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        onStepStart: (step) => started.push(step.id),
        onStepFail: (step, error) => failed.push({ stepId: step.id, error }),
      })

      await executeAbility(singleScriptAbility, {}, ctx)

      expect(started).toContain('build')
      expect(failed).toHaveLength(1)
      expect(failed[0].stepId).toBe('build')
      expect(failed[0].error).toContain('permission')
    })

    it('does NOT fire onStepComplete for denied steps', async () => {
      const completed: string[] = []

      const perms: AgentPermissions = { agent: 'nobody', permissions: [] }
      const ctx = baseCtx({
        permissionValidator: validator,
        agentPermissions: perms,
        onStepComplete: (step) => completed.push(step.id),
      })

      await executeAbility(singleScriptAbility, {}, ctx)

      expect(completed).toHaveLength(0)
    })
  })

  describe('checkStepPermission unit tests (via validator)', () => {
    const perms: AgentPermissions = {
      agent: 'test-agent',
      permissions: [
        { skill: 'script', tools: ['build', 'test'] },
        { skill: 'agent', tools: ['researcher'] },
        { skill: 'workflow', tools: ['*'] },
        { skill: 'web-search', tools: ['*'] },
      ],
    }

    it('allows permitted script step', () => {
      const r = validator.checkStepPermission(
        { id: 'build', type: 'script', run: 'echo' },
        perms,
      )
      expect(r.allowed).toBe(true)
    })

    it('denies unpermitted script step', () => {
      const r = validator.checkStepPermission(
        { id: 'deploy', type: 'script', run: 'echo' },
        perms,
      )
      expect(r.allowed).toBe(false)
      expect(r.reason).toContain('deploy')
    })

    it('allows when no permissions provided (opt-in)', () => {
      const r = validator.checkStepPermission(
        { id: 'anything', type: 'script', run: 'echo' },
      )
      expect(r.allowed).toBe(true)
    })

    it('allows approval steps unconditionally', () => {
      const r = validator.checkStepPermission(
        { id: 'gate', type: 'approval', prompt: 'OK?' },
        { agent: 'nobody', permissions: [] },
      )
      expect(r.allowed).toBe(true)
    })

    it('allows permitted agent step', () => {
      const r = validator.checkStepPermission(
        { id: 'ask', type: 'agent', agent: 'researcher', prompt: 'help' },
        perms,
      )
      expect(r.allowed).toBe(true)
    })

    it('denies unpermitted agent step', () => {
      const r = validator.checkStepPermission(
        { id: 'ask', type: 'agent', agent: 'writer', prompt: 'write' },
        perms,
      )
      expect(r.allowed).toBe(false)
    })

    it('allows wildcard workflow', () => {
      const r = validator.checkStepPermission(
        { id: 'run', type: 'workflow', workflow: 'any-pipeline' },
        perms,
      )
      expect(r.allowed).toBe(true)
    })

    it('allows skill with matching permission', () => {
      const r = validator.checkStepPermission(
        { id: 'search', type: 'skill', skill: 'web-search' },
        perms,
      )
      expect(r.allowed).toBe(true)
    })

    it('denies skill without matching permission', () => {
      const r = validator.checkStepPermission(
        { id: 'hack', type: 'skill', skill: 'admin-panel' },
        perms,
      )
      expect(r.allowed).toBe(false)
    })
  })
})
