import { describe, expect, it, beforeEach } from 'bun:test'
import {
  ObligationRegistry,
  defaultRegistry,
  resolveObligations,
  getBuiltinObligations,
} from '../src/control/obligation-registry.js'
import { evaluateControl, evaluateControlFromEvents } from '../src/control/index.js'
import { ControlEventFactory } from '../src/control/events.js'
import type { ControlEvent } from '../src/control/events.js'
import { ControlEventBus } from '../src/control/event-bus.js'
import { executeAbility } from '../src/executor/index.js'
import type { Ability, ExecutorContext, ObligationDefinition } from '../src/types/index.js'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const createMockContext = (): ExecutorContext => ({
  cwd: process.cwd(),
  env: {},
})

function createFactory(runId = 'run_test'): ControlEventFactory {
  return new ControlEventFactory({
    run_id: runId,
    ability_execution_id: 'exec_test',
  })
}

// ─────────────────────────────────────────────────────────────
// ObligationRegistry — unit tests
// ─────────────────────────────────────────────────────────────

describe('ObligationRegistry', () => {
  let registry: ObligationRegistry

  beforeEach(() => {
    registry = new ObligationRegistry()
  })

  describe('resolve — built-in defaults', () => {
    it('resolves built-in obligations for code_change', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'code_change',
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(8)
      expect(defs.map((d) => d.key)).toEqual([
        'run_tests',
        'record_validation',
        'commit_if_required',
        'requirements_checked',
        'affected_files_identified',
        'implementation_recorded',
        'review_completed',
        'verification_evidence_recorded',
      ])
    })

    it('resolves built-in obligations for paper_screening', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'paper_screening',
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(1)
      expect(defs[0].key).toBe('record_screening_decision')
    })

    it('returns empty array for unknown task_type', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'unknown_type',
        steps: [],
      }
      expect(registry.resolve(ability)).toEqual([])
    })

    it('returns empty array when no task_type', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        steps: [],
      }
      expect(registry.resolve(ability)).toEqual([])
    })
  })

  describe('resolve — inline obligations (highest priority)', () => {
    it('uses inline obligations when present, ignoring built-in', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'code_change',
        obligations: [
          { key: 'custom_check', severity: 'hard', tags: ['custom'] },
        ],
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(1)
      expect(defs[0].key).toBe('custom_check')
    })

    it('uses inline obligations with custom task_type', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'data_pipeline',
        obligations: [
          { key: 'run_pipeline', severity: 'hard', tags: ['pipeline'] },
          { key: 'validate_output', severity: 'hard', tags: ['output-validation'] },
          { key: 'notify_downstream', severity: 'soft', tags: ['notification'] },
        ],
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(3)
      expect(defs.map((d) => d.key)).toEqual([
        'run_pipeline',
        'validate_output',
        'notify_downstream',
      ])
    })

    it('uses inline obligations even without task_type', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        obligations: [
          { key: 'some_obligation', severity: 'hard', tags: ['check'] },
        ],
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(1)
    })

    it('treats empty obligations array as "no inline" — falls back to built-in', () => {
      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'code_change',
        obligations: [],
        steps: [],
      }
      const defs = registry.resolve(ability)
      // Empty array means "no inline", so falls through to built-in
      expect(defs).toHaveLength(8)
    })
  })

  describe('resolve — runtime registered (middle priority)', () => {
    it('uses runtime-registered obligations for a task_type', () => {
      registry.register('deploy', [
        { key: 'run_deploy_check', severity: 'hard', tags: ['deploy-check'] },
      ])

      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'deploy',
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(1)
      expect(defs[0].key).toBe('run_deploy_check')
    })

    it('runtime-registered overrides built-in for same task_type', () => {
      registry.register('code_change', [
        { key: 'enhanced_test', severity: 'hard', tags: ['test', 'lint'] },
      ])

      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'code_change',
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(1)
      expect(defs[0].key).toBe('enhanced_test')
    })

    it('inline obligations override runtime-registered', () => {
      registry.register('deploy', [
        { key: 'runtime_check', severity: 'hard', tags: ['runtime'] },
      ])

      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'deploy',
        obligations: [
          { key: 'inline_check', severity: 'hard', tags: ['inline'] },
        ],
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(1)
      expect(defs[0].key).toBe('inline_check')
    })

    it('unregister restores built-in behavior', () => {
      registry.register('code_change', [
        { key: 'custom', severity: 'hard', tags: ['custom'] },
      ])
      registry.unregister('code_change')

      const ability: Ability = {
        name: 'test',
        description: 'test',
        task_type: 'code_change',
        steps: [],
      }
      const defs = registry.resolve(ability)
      expect(defs).toHaveLength(8) // back to built-in
    })
  })

  describe('getKnownTaskTypes', () => {
    it('returns all built-in task types', () => {
      const types = registry.getKnownTaskTypes()
      expect(types).toContain('code_change')
      expect(types).toContain('paper_screening')
      expect(types).toContain('paper_fulltext_review')
      expect(types).toContain('literature_decision')
      expect(types).toContain('section_evidence_pack')
      expect(types).toContain('citation_audit')
    })

    it('includes runtime-registered task types', () => {
      registry.register('deploy', [])
      const types = registry.getKnownTaskTypes()
      expect(types).toContain('deploy')
    })

    it('returns sorted list', () => {
      registry.register('aaa_type', [])
      registry.register('zzz_type', [])
      const types = registry.getKnownTaskTypes()
      expect(types[0]).toBe('aaa_type')
      expect(types[types.length - 1]).toBe('zzz_type')
    })
  })

  describe('hasTaskType', () => {
    it('returns true for built-in types', () => {
      expect(registry.hasTaskType('code_change')).toBe(true)
    })

    it('returns true for runtime-registered types', () => {
      registry.register('deploy', [])
      expect(registry.hasTaskType('deploy')).toBe(true)
    })

    it('returns false for unknown types', () => {
      expect(registry.hasTaskType('unknown_type')).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears runtime registrations', () => {
      registry.register('deploy', [])
      registry.reset()
      expect(registry.hasTaskType('deploy')).toBe(false)
      // Built-in still works
      expect(registry.hasTaskType('code_change')).toBe(true)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// getBuiltinObligations — functional helper
// ─────────────────────────────────────────────────────────────

describe('getBuiltinObligations', () => {
  it('returns built-in obligations for code_change', () => {
    const defs = getBuiltinObligations('code_change')
    expect(defs).toHaveLength(8)
  })

  it('returns empty for unknown task type', () => {
    expect(getBuiltinObligations('nonexistent')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// evaluateControl — with inline obligations
// ─────────────────────────────────────────────────────────────

describe('evaluateControl — inline obligations', () => {
  it('blocks when inline hard obligation is missing', () => {
    const ability: Ability = {
      name: 'custom-task',
      description: 'test',
      task_type: 'data_pipeline',
      obligations: [
        { key: 'run_pipeline', severity: 'hard', tags: ['pipeline'] },
        { key: 'validate_output', severity: 'hard', tags: ['output-check'] },
      ],
      steps: [],
    }

    const result = evaluateControl(ability, [])!
    expect(result).toBeDefined()
    expect(result.taskType).toBe('data_pipeline')
    expect(result.gate.verdict).toBe('block')
    expect(result.obligations).toHaveLength(2)
    expect(result.obligations[0].status).toBe('missing')
    expect(result.obligations[1].status).toBe('missing')
  })

  it('allows when all inline hard obligations are satisfied', () => {
    const ability: Ability = {
      name: 'custom-task',
      description: 'test',
      task_type: 'data_pipeline',
      obligations: [
        { key: 'run_pipeline', severity: 'hard', tags: ['pipeline'] },
      ],
      steps: [],
    }

    const result = evaluateControl(ability, [
      {
        stepId: 'run',
        status: 'completed',
        tags: ['pipeline'],
        startedAt: 0,
        completedAt: 100,
        duration: 100,
      },
    ])!
    expect(result.gate.verdict).toBe('allow')
    expect(result.obligations[0].status).toBe('satisfied')
  })

  it('warns on missing soft inline obligation', () => {
    const ability: Ability = {
      name: 'custom-task',
      description: 'test',
      task_type: 'data_pipeline',
      obligations: [
        { key: 'run_pipeline', severity: 'hard', tags: ['pipeline'] },
        { key: 'notify_team', severity: 'soft', tags: ['notification'] },
      ],
      steps: [],
    }

    const result = evaluateControl(ability, [
      {
        stepId: 'run',
        status: 'completed',
        tags: ['pipeline'],
        startedAt: 0,
        completedAt: 100,
        duration: 100,
      },
    ])!
    expect(result.gate.verdict).toBe('warn')
    expect(result.gate.warnings).toContain('Missing soft obligation: notify_team')
  })

  it('uses inline obligations, not built-in, even for known task_type', () => {
    const ability: Ability = {
      name: 'override-code-change',
      description: 'test',
      task_type: 'code_change',
      obligations: [
        { key: 'custom_only', severity: 'hard', tags: ['custom'] },
      ],
      steps: [],
    }

    const result = evaluateControl(ability, [])!
    // Only the inline obligation, not the 3 built-in code_change ones
    expect(result.obligations).toHaveLength(1)
    expect(result.obligations[0].key).toBe('custom_only')
  })

  it('returns undefined when no task_type and no obligations', () => {
    const ability: Ability = {
      name: 'no-control',
      description: 'test',
      steps: [],
    }
    expect(evaluateControl(ability, [])).toBeUndefined()
  })

  it('evaluates inline obligations even without task_type', () => {
    const ability: Ability = {
      name: 'obligations-only',
      description: 'test',
      obligations: [
        { key: 'custom_check', severity: 'hard', tags: ['check'] },
      ],
      steps: [],
    }

    const result = evaluateControl(ability, [])!
    expect(result).toBeDefined()
    expect(result.taskType).toBe('custom')
    expect(result.gate.verdict).toBe('block')
  })
})

// ─────────────────────────────────────────────────────────────
// evaluateControl — with arbitrary task_type string
// ─────────────────────────────────────────────────────────────

describe('evaluateControl — arbitrary task_type', () => {
  it('allows when unknown task_type has no obligations (no control)', () => {
    const ability: Ability = {
      name: 'test',
      description: 'test',
      task_type: 'my_custom_workflow',
      steps: [],
    }

    // Unknown task_type with no inline obligations resolves to empty obligations
    // Gate with empty obligations should allow
    const result = evaluateControl(ability, [])!
    expect(result).toBeDefined()
    expect(result.taskType).toBe('my_custom_workflow')
    expect(result.gate.verdict).toBe('allow')
    expect(result.obligations).toHaveLength(0)
  })

  it('blocks when arbitrary task_type has inline hard obligations missing', () => {
    const ability: Ability = {
      name: 'test',
      description: 'test',
      task_type: 'my_custom_workflow',
      obligations: [
        { key: 'custom_check', severity: 'hard', tags: ['check'] },
      ],
      steps: [],
    }

    const result = evaluateControl(ability, [])!
    expect(result.gate.verdict).toBe('block')
  })
})

// ─────────────────────────────────────────────────────────────
// evaluateControlFromEvents — with inline obligations
// ─────────────────────────────────────────────────────────────

describe('evaluateControlFromEvents — inline obligations', () => {
  let factory: ControlEventFactory

  beforeEach(() => {
    factory = createFactory()
  })

  it('evaluates inline obligations from event stream', () => {
    const ability: Ability = {
      name: 'event-inline-test',
      description: 'test',
      task_type: 'data_pipeline',
      obligations: [
        { key: 'run_pipeline', severity: 'hard', tags: ['pipeline'] },
        { key: 'validate_output', severity: 'hard', tags: ['output-check'] },
      ],
      steps: [],
    }

    const events: ControlEvent[] = [
      factory.runStarted('event-inline-test', {}),
      factory.stepCompleted('event-inline-test', 's1', 'script', 'completed', 100, {
        tags: ['pipeline'],
      }),
      factory.stepCompleted('event-inline-test', 's2', 'script', 'completed', 100, {
        tags: ['output-check'],
      }),
      factory.runCompleted('event-inline-test', 'completed', 200),
    ]

    const result = evaluateControlFromEvents(ability, events)!
    expect(result.gate.verdict).toBe('allow')
    expect(result.obligations[0].status).toBe('satisfied')
    expect(result.obligations[1].status).toBe('satisfied')
  })

  it('blocks when inline hard obligation is not satisfied via events', () => {
    const ability: Ability = {
      name: 'event-block-test',
      description: 'test',
      task_type: 'data_pipeline',
      obligations: [
        { key: 'run_pipeline', severity: 'hard', tags: ['pipeline'] },
      ],
      steps: [],
    }

    const events: ControlEvent[] = [
      factory.runStarted('event-block-test', {}),
      factory.stepCompleted('event-block-test', 's1', 'script', 'completed', 100, {
        tags: ['unrelated-tag'],
      }),
      factory.runCompleted('event-block-test', 'completed', 100),
    ]

    const result = evaluateControlFromEvents(ability, events)!
    expect(result.gate.verdict).toBe('block')
  })
})

// ─────────────────────────────────────────────────────────────
// End-to-end: custom task_type with inline obligations
// ─────────────────────────────────────────────────────────────

describe('end-to-end: custom task_type through execution pipeline', () => {
  it('executes ability with custom task_type and inline obligations — satisfied', async () => {
    const bus = new ControlEventBus()

    const ability: Ability = {
      name: 'custom-e2e',
      description: 'Custom task type end-to-end',
      task_type: 'deployment',
      obligations: [
        { key: 'pre_deploy_check', severity: 'hard', tags: ['deploy-check'] },
        { key: 'notify_ops', severity: 'soft', tags: ['notification'] },
      ],
      steps: [
        {
          id: 'check',
          type: 'script',
          run: 'echo deploy check passed',
          tags: ['deploy-check'],
        },
        {
          id: 'notify',
          type: 'script',
          run: 'echo notified ops',
          tags: ['notification'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext(), { eventBus: bus })
    expect(execution.status).toBe('completed')
    expect(execution.control).toBeDefined()
    expect(execution.control!.taskType).toBe('deployment')
    expect(execution.control!.gate.verdict).toBe('allow')
    expect(execution.control!.obligations).toHaveLength(2)
    expect(execution.control!.obligations[0].status).toBe('satisfied')
    expect(execution.control!.obligations[1].status).toBe('satisfied')
  })

  it('blocks ability with custom task_type when hard obligation missing', async () => {
    const bus = new ControlEventBus()

    const ability: Ability = {
      name: 'custom-e2e-block',
      description: 'Custom task type that blocks',
      task_type: 'deployment',
      obligations: [
        { key: 'pre_deploy_check', severity: 'hard', tags: ['deploy-check'] },
      ],
      steps: [
        {
          id: 'other-step',
          type: 'script',
          run: 'echo unrelated work',
          // no deploy-check tag!
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext(), { eventBus: bus })
    // Gate blocks → execution is marked failed
    expect(execution.status).toBe('failed')
    expect(execution.control!.gate.verdict).toBe('block')
    expect(execution.control!.obligations[0].status).toBe('missing')
  })

  it('built-in task_type still works without inline obligations', async () => {
    const bus = new ControlEventBus()

    const ability: Ability = {
      name: 'builtin-still-works',
      description: 'code_change without inline obligations',
      task_type: 'code_change',
      steps: [
        {
          id: 'test',
          type: 'script',
          run: 'echo tests pass',
          tags: ['test'],
        },
        {
          id: 'validate',
          type: 'script',
          run: 'echo validated',
          tags: ['validation'],
        },
        {
          id: 'commit',
          type: 'script',
          run: 'echo committed',
          tags: ['commit'],
        },
      ],
    }

    const execution = await executeAbility(ability, {}, createMockContext(), { eventBus: bus })
    expect(execution.status).toBe('completed')
    expect(execution.control!.gate.verdict).toBe('warn')
    // Built-in code_change has 8 obligations
    expect(execution.control!.obligations).toHaveLength(8)
  })

  it('works without event bus (step-based evaluation) with custom obligations', async () => {
    const ability: Ability = {
      name: 'no-bus-custom',
      description: 'Custom obligations without event bus',
      task_type: 'review',
      obligations: [
        { key: 'perform_review', severity: 'hard', tags: ['review'] },
      ],
      steps: [
        {
          id: 'review',
          type: 'script',
          run: 'echo review complete',
          tags: ['review'],
        },
      ],
    }

    // No eventBus
    const execution = await executeAbility(ability, {}, createMockContext())
    expect(execution.status).toBe('completed')
    expect(execution.control!.gate.verdict).toBe('allow')
    expect(execution.control!.obligations[0].key).toBe('perform_review')
    expect(execution.control!.obligations[0].status).toBe('satisfied')
  })

  it('event-based gates include sufficiency and capability checks', () => {
    const ability: Ability = {
      name: 'gate-eval',
      description: 'Gate eval',
      task_type: 'research_evidence_control',
      obligations: [
        {
          key: 'task_level_sufficiency_check',
          severity: 'hard',
          tags: ['task-sufficiency-check'],
          signals: ['task_level_sufficiency_check'],
          requiredFields: ['sufficiency_score'],
        },
      ],
      steps: [],
    }

    const factory = createFactory('run_gate_eval')
    const events: ControlEvent[] = [
      factory.stepCompleted('gate-eval', 's1', 'script', 'completed', 10, {
        tags: ['task-sufficiency-check'],
      }),
      factory.evidenceStats('gate-eval', {
        sufficiency_score: 0.5,
        capability_ok: false,
      }, { step_id: 's1' }),
    ]

    const result = evaluateControlFromEvents(ability, events)!
    expect(result.gate.verdict).toBe('block')
    expect(result.gates?.some((g) => g.name === 'sufficiency_gate' && g.verdict === 'block')).toBe(true)
    expect(result.gates?.some((g) => g.name === 'capability_gate' && g.verdict === 'block')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// Backward compatibility — existing tests should still pass
// ─────────────────────────────────────────────────────────────

describe('backward compatibility', () => {
  it('paper_fulltext_review blocks when required obligations are missing', async () => {
    const ability: Ability = {
      name: 'paper-review-missing',
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
    expect(execution.status).toBe('failed')
    expect(execution.control?.gate.verdict).toBe('block')
  })

  it('paper_fulltext_review allows when obligations satisfied', async () => {
    const ability: Ability = {
      name: 'paper-review-ok',
      description: 'Review with evidence',
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
    expect(execution.status).toBe('completed')
    expect(execution.control?.gate.verdict).toBe('allow')
  })

  it('code_change warns on missing soft obligation', async () => {
    const ability: Ability = {
      name: 'code-change-warn',
      description: 'Code change without commit',
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
