import { describe, it, expect } from 'bun:test'
import type { AbilityExecution } from '../src/types/index.js'
import { deriveCompletionSummary } from '../src/coding/completion-summary.js'

function baseExecution(): AbilityExecution {
  return {
    id: 'exec_1',
    ability: {
      name: 'development/code-change',
      description: 'test',
      task_type: 'code_change',
      steps: [],
    },
    inputs: {
      task_id: 'task_001',
    },
    status: 'completed',
    executionStatus: 'completed',
    currentStep: null,
    currentStepIndex: -1,
    completedSteps: [],
    pendingSteps: [],
    startedAt: Date.now() - 100,
    completedAt: Date.now(),
    control: {
      taskType: 'code_change',
      obligations: [
        { key: 'run_tests', severity: 'hard', status: 'satisfied', evidenceStepIds: ['validate'] },
        { key: 'record_validation', severity: 'hard', status: 'satisfied', evidenceStepIds: ['validate'] },
        { key: 'verification_evidence_recorded', severity: 'hard', status: 'satisfied', evidenceStepIds: ['validate'] },
        { key: 'review_completed', severity: 'hard', status: 'satisfied', evidenceStepIds: ['review'] },
      ],
      gate: { verdict: 'allow', reasons: [], warnings: [] },
    },
  }
}

describe('deriveCompletionSummary', () => {
  it('returns completed when gate allows and evidence is complete', () => {
    const execution = baseExecution()
    const summary = deriveCompletionSummary(execution)
    expect(summary).not.toBeNull()
    expect(summary!.status).toBe('completed')
    expect(summary!.validated).toBe(true)
    expect(summary!.reviewed).toBe(true)
    expect(summary!.remaining_risks).toEqual([])
  })

  it('returns blocked when gate is block', () => {
    const execution = baseExecution()
    execution.control!.gate = {
      verdict: 'block',
      reasons: ['Validation evidence indicates failing verification results.'],
      warnings: [],
    }

    const summary = deriveCompletionSummary(execution)
    expect(summary).not.toBeNull()
    expect(summary!.status).toBe('blocked')
    expect(summary!.remaining_risks).toContain('Validation evidence indicates failing verification results.')
    expect(summary!.next_actions).toContain('Resolve blocking validation/review issues before claiming completion.')
  })

  it('returns partial when gate warns and preserves artifact next_actions', () => {
    const execution = baseExecution()
    execution.control!.gate = {
      verdict: 'warn',
      reasons: [],
      warnings: ['Declared scope or affected files evidence is incomplete.'],
    }
    execution.completedSteps.push({
      stepId: 'complete',
      status: 'completed',
      output: JSON.stringify({
        status: 'partial',
        remaining_risks: ['Manual verification pending'],
        next_actions: ['Run end-to-end tests'],
      }),
      startedAt: Date.now() - 10,
      completedAt: Date.now(),
      duration: 10,
    })

    const summary = deriveCompletionSummary(execution)
    expect(summary).not.toBeNull()
    expect(summary!.status).toBe('partial')
    expect(summary!.remaining_risks).toContain('Declared scope or affected files evidence is incomplete.')
    expect(summary!.remaining_risks).toContain('Manual verification pending')
    expect(summary!.next_actions).toContain('Run end-to-end tests')
  })

  it('returns null for non-code_change task types', () => {
    const execution = baseExecution()
    execution.ability.task_type = 'paper_screening'
    const summary = deriveCompletionSummary(execution)
    expect(summary).toBeNull()
  })
})
