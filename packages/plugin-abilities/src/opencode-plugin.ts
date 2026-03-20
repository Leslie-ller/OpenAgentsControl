import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import type { Ability, LoadedAbility, ExecutorContext } from './types/index.js'
import { loadAbilities } from './loader/index.js'
import { validateAbility, validateInputs } from './validator/index.js'
import { formatExecutionResult } from './executor/index.js'
import { ExecutionManager } from './executor/execution-manager.js'
import { ControlEventBus } from './control/event-bus.js'
import { EventLog } from './control/event-log.js'
import { createBibliographyStore } from './bibliography/store.js'
import { BibliographyPipeline } from './bibliography/pipeline.js'
import { parseCommandInput, routeBibliographyCommand } from './bibliography/command-routing.js'
import { scanBibliographyArtifacts } from './bibliography/audit-scan.js'
import { deriveCompletionSummary } from './coding/completion-summary.js'
import { createCodingArtifactStore } from './coding/artifact-store.js'
import type { CodingArtifactType } from './coding/artifact-store.js'
import { createCheckpointStore } from './runtime/context/checkpoint-store.js'
import { createCompactionCheckpoint } from './runtime/context/compaction-checkpoint.js'
import { renderDetailReinjectionBlock, selectDetailFields } from './runtime/context/detail-reinjector.js'
import { renderFocusRefreshBlock } from './runtime/context/focus-refresh.js'
import { PendingCheckpointSummaries } from './runtime/context/pending-checkpoint-summaries.js'
import { resolveTopicFromExecution } from './runtime/context/topic-resolver.js'
import type { DetailUseCase } from './runtime/context/types.js'
import type { FocusTrigger } from './runtime/context/focus-refresh.js'
import { createOpencodeAgentContext } from './runtime/opencode-agent-context.js'
import { join } from 'path'

/**
 * Minimal Abilities Plugin
 * 
 * Stripped to essentials:
 * - Load abilities from YAML
 * - Execute script steps sequentially
 * - Block tools during execution (enforcement)
 * - Inject context into chat messages
 * 
 * NO: sessions, agents, triggers, toasts, cleanup timers
 */

// Tools that are ALWAYS allowed (read-only)
const ALWAYS_ALLOWED_TOOLS = [
  'ability_list',
  'ability_status',
  'ability_context_detail',
  'ability_cancel',
  'read',
  'glob',
  'grep',
]

export const AbilitiesPlugin: Plugin = async (ctx) => {
  const abilities = new Map<string, LoadedAbility>()
  const pendingCheckpointSummaries = new PendingCheckpointSummaries()
  const pendingFocusTriggers = new Map<string, FocusTrigger>()
  const lastActiveStepBySession = new Map<string, string>()
  const modelBySession = new Map<string, { providerID: string; modelID: string }>()

  // Initialize control event infrastructure
  const controlLogDir = join(ctx.directory, '.opencode', 'control-logs')
  const eventLog = new EventLog({ logDir: controlLogDir })
  const eventBus = new ControlEventBus({ log: eventLog })
  const executionManager = new ExecutionManager(eventBus)
  const bibliographyStore = createBibliographyStore(ctx.directory)
  const bibliographyPipeline = new BibliographyPipeline(bibliographyStore)
  const checkpointStore = createCheckpointStore(ctx.directory)
  const codingArtifactStore = createCodingArtifactStore(ctx.directory)

  const abilitiesDir = `${ctx.directory}/.opencode/abilities`
  const LARGE_TOOL_OUTPUT_THRESHOLD = 4000
  const CODING_ARTIFACT_TYPES: CodingArtifactType[] = [
    'task-plan',
    'subtask-record',
    'implementation-result',
    'validation-report',
    'review-report',
    'completion-summary',
  ]

  const normalizeSessionKey = (sessionID: unknown): string => {
    return typeof sessionID === 'string' && sessionID.trim().length > 0
      ? sessionID
      : '__global__'
  }

  const extractSessionID = (value: unknown): string | undefined => {
    const direct = (value as any)?.sessionID
    if (typeof direct === 'string' && direct.trim().length > 0) return direct

    const fromMessage = (value as any)?.message?.sessionID
    if (typeof fromMessage === 'string' && fromMessage.trim().length > 0) return fromMessage

    const fromProperties = (value as any)?.properties?.info?.id
    if (typeof fromProperties === 'string' && fromProperties.trim().length > 0) return fromProperties

    return undefined
  }

  const queueFocusTrigger = (sessionID: string | undefined, trigger: FocusTrigger): void => {
    pendingFocusTriggers.set(normalizeSessionKey(sessionID), trigger)
  }

  const consumeQueuedFocusTrigger = (sessionID: string | undefined): FocusTrigger | undefined => {
    const key = normalizeSessionKey(sessionID)
    const trigger = pendingFocusTriggers.get(key)
    if (trigger) pendingFocusTriggers.delete(key)
    return trigger
  }

  const consumeStageTransitionTrigger = (
    sessionID: string | undefined,
    activeStepID: string | undefined
  ): FocusTrigger | undefined => {
    const key = normalizeSessionKey(sessionID)
    if (!activeStepID) {
      lastActiveStepBySession.delete(key)
      return undefined
    }

    const previous = lastActiveStepBySession.get(key)
    lastActiveStepBySession.set(key, activeStepID)
    if (previous && previous !== activeStepID) {
      return 'workflow_stage_transition'
    }
    return undefined
  }

  const estimateOutputSize = (payload: unknown): number => {
    if (payload === undefined || payload === null) return 0
    if (typeof payload === 'string') return payload.length
    try {
      return JSON.stringify(payload).length
    } catch {
      return 0
    }
  }

  // Load abilities on startup
  try {
    const loaded = await loadAbilities({ projectDir: abilitiesDir, includeGlobal: false })
    for (const [name, ability] of loaded) {
      abilities.set(name, ability)
    }
    console.log(`[abilities] Loaded ${abilities.size} abilities from ${abilitiesDir}`)
  } catch (err) {
    console.log(`[abilities] Could not load abilities:`, err instanceof Error ? err.message : err)
  }

  const createExecutorContext = (runtime?: {
    sessionID?: string
    agent?: string
  }): ExecutorContext => {
    const inheritedModel = runtime?.sessionID
      ? modelBySession.get(runtime.sessionID)
      : undefined

    return {
      cwd: ctx.directory,
      env: {},
      agents: createOpencodeAgentContext({
        client: ctx.client as any,
        directory: ctx.directory,
        parentSessionID: runtime?.sessionID,
        agent: runtime?.agent,
        model: inheritedModel,
      }),
    }
  }

  const buildAbilityContextInjection = (execution: any): string => {
    const ability = execution.ability
    const currentStep = execution.currentStep
    const completed = execution.completedSteps.length
    const total = ability.steps.length

    const lines = [
      `## 🔄 Active Ability: ${ability.name}`,
      '',
      `**Progress:** ${completed}/${total} steps completed`,
      '',
    ]

    if (currentStep) {
      lines.push(`### Current Step: ${currentStep.id}`)
      if (currentStep.description) lines.push(currentStep.description)
      lines.push('')
      lines.push(`**Action:** Script is executing. Wait for completion.`)
      lines.push('')
      lines.push('⚠️ **ENFORCEMENT ACTIVE** - Other tools are blocked until step completes.')
    }

    return lines.join('\n')
  }

  const executeAbilityByName = async (
    name: string,
    inputs: Record<string, unknown> = {},
    runtime?: { sessionID?: string; agent?: string }
  ) => {
    const loaded = abilities.get(name)
    if (!loaded) {
      return JSON.stringify({ error: `Ability '${name}' not found` })
    }

    const ability = loaded.ability
    const inputErrors = validateInputs(ability, inputs)
    if (inputErrors.length > 0) {
      return JSON.stringify({
        error: 'Input validation failed',
        details: inputErrors.map(e => e.message),
      })
    }

    try {
      const execution = await executionManager.execute(
        ability,
        inputs,
        createExecutorContext(runtime)
      )

      if (ability.task_type === 'code_change' && execution.control) {
        const taskId = typeof inputs.task_id === 'string' && inputs.task_id.trim().length > 0
          ? inputs.task_id
          : `task_${Date.now()}`

        try {
          const summary = deriveCompletionSummary(execution)
          if (summary) {
            await codingArtifactStore.save('completion-summary', taskId, taskId, summary)
          }

          const validateStep = execution.completedSteps.find((s) => s.stepId === 'validate')
          if (validateStep?.output) {
            try {
              const validationData = JSON.parse(validateStep.output.trim()) as Record<string, unknown>
              await codingArtifactStore.save('validation-report', taskId, taskId, validationData)
            } catch {
              // ignore non-JSON validation output
            }
          }

          const reviewStep = execution.completedSteps.find((s) => s.stepId === 'review')
          if (reviewStep?.output) {
            try {
              const reviewData = JSON.parse(reviewStep.output.trim()) as Record<string, unknown>
              await codingArtifactStore.save('review-report', taskId, taskId, reviewData)
            } catch {
              // ignore non-JSON review output
            }
          }
        } catch (err) {
          console.error('[abilities] Failed to persist coding artifacts:', err)
        }
      }

      return JSON.stringify({
        status: execution.status,
        executionStatus: execution.executionStatus || execution.status,
        ability: ability.name,
        control: execution.control,
        completion: deriveCompletionSummary(execution) ?? undefined,
        result: formatExecutionResult(execution),
      })
    } catch (error) {
      return JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const executeBibliographyCommand = async (
    command: string,
    args: Record<string, unknown>,
    runtime?: { sessionID?: string; agent?: string }
  ) => {
    const routed = routeBibliographyCommand(command, args)

    if (!routed) {
      return JSON.stringify({
        status: 'error',
        error: `No runtime ability mapping for command '${command}'`,
      })
    }

    const loaded = abilities.get(routed.abilityName)
    if (!loaded) {
      return JSON.stringify({
        status: 'error',
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        error: `Ability '${routed.abilityName}' not found`,
      })
    }

    const ability = loaded.ability
    const inputErrors = validateInputs(ability, routed.inputs)
    if (inputErrors.length > 0) {
      return JSON.stringify({
        status: 'error',
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        inputs: routed.inputs,
        error: 'Input validation failed',
        details: inputErrors.map((e) => e.message),
      })
    }

    try {
      const stageResult = await bibliographyPipeline.runStageCommand(
        routed.stage,
        ability,
        routed.inputs,
        createExecutorContext(runtime),
        { executorOptions: { eventBus } }
      )

      return JSON.stringify({
        status: stageResult.execution.status === 'completed' ? 'ok' : 'error',
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        inputs: routed.inputs,
        execution: stageResult.execution,
        artifact: stageResult.artifact,
        error: stageResult.execution.status === 'failed'
          ? (stageResult.execution.error || 'Ability execution failed')
          : undefined,
      })
    } catch (error) {
      return JSON.stringify({
        status: 'error',
        command,
        stage: routed.stage,
        routedAbility: routed.abilityName,
        inputs: routed.inputs,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    // Hook: Inject ability context into every chat message
    async 'chat.message'(input, output) {
      try {
        if (input.model?.providerID && input.model?.modelID) {
          modelBySession.set(input.sessionID, input.model)
        }

        const sessionID = extractSessionID(input)
        const injections: string[] = []
        const pendingSummary = pendingCheckpointSummaries.consume(
          typeof sessionID === 'string' ? sessionID : undefined
        )
        if (pendingSummary) {
          injections.push(`Post-Compaction Recovery:\n${pendingSummary}`)
        }

        const activeExecution = executionManager.getActive()

        if (activeExecution && activeExecution.status === 'running') {
          const topic = resolveTopicFromExecution(activeExecution)
          const state = await checkpointStore.loadState(topic)
          if (state) {
            const trigger = consumeQueuedFocusTrigger(sessionID)
              ?? consumeStageTransitionTrigger(sessionID, activeExecution.currentStep?.id)
              ?? 'pre_high_impact_decision'
            injections.push(renderFocusRefreshBlock(state, trigger))
          }

          injections.push(buildAbilityContextInjection(activeExecution))
        } else {
          lastActiveStepBySession.delete(normalizeSessionKey(sessionID))
        }

        for (let i = injections.length - 1; i >= 0; i -= 1) {
          output.parts.unshift({
            type: 'text',
            text: injections[i],
          } as any)
        }
      } catch (err) {
        console.error('[abilities] chat.message error:', err)
      }
    },

    // Hook: Block unauthorized tools during ability execution
    async 'tool.execute.before'(input, _output) {
      try {
        const execution = executionManager.getActive()
        if (!execution) return // No ability running, allow all tools

        const currentStep = execution.currentStep
        if (!currentStep) return

        // Always allow read-only tools
        if (ALWAYS_ALLOWED_TOOLS.includes(input.tool)) return

        // Script steps block ALL other tools (deterministic execution)
        if (currentStep.type === 'script') {
          throw new Error(
            `[abilities] Tool '${input.tool}' blocked during script step '${currentStep.id}'. ` +
            `Script steps run deterministically - wait for completion.`
          )
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('[abilities]')) {
          throw err
        }
        console.error('[abilities] tool.execute.before error:', err)
      }
    },

    // Hook: Capture signals for richer focus refresh triggers
    async 'tool.execute.after'(input, output) {
      try {
        const execution = executionManager.getActive()
        if (!execution || execution.status !== 'running') return

        const sessionID = extractSessionID(input)
        const toolName = (input as any)?.tool
        if (toolName === 'task') {
          queueFocusTrigger(sessionID, 'subagent_return')
        }

        const outputSize = estimateOutputSize((output as any)?.output ?? output)
        if (outputSize >= LARGE_TOOL_OUTPUT_THRESHOLD) {
          queueFocusTrigger(sessionID, 'large_tool_output')
        }
      } catch (err) {
        console.error('[abilities] tool.execute.after error:', err)
      }
    },

    // Hook: Cleanup on session deletion
    async event({ event }) {
      try {
        if (event.type === 'session.compacted') {
          const activeExecution = executionManager.getActive()
          if (activeExecution) {
            const checkpoint = await createCompactionCheckpoint(activeExecution, checkpointStore)
            const sessionID = (event as any)?.properties?.info?.id
            pendingCheckpointSummaries.put(typeof sessionID === 'string' ? sessionID : undefined, checkpoint.summary)
            console.log(`[abilities] Compaction checkpoint saved for topic '${checkpoint.topic}'`)
          }
        }

        if (event.type === 'session.deleted') {
          const sessionID = (event as any)?.properties?.info?.id
          pendingCheckpointSummaries.clear(typeof sessionID === 'string' ? sessionID : undefined)
          pendingFocusTriggers.delete(normalizeSessionKey(sessionID))
          lastActiveStepBySession.delete(normalizeSessionKey(sessionID))
          if (typeof sessionID === 'string') {
            modelBySession.delete(sessionID)
          }
          executionManager.cleanup()
          eventBus.reset()
        }
      } catch (err) {
        console.error('[abilities] event handler error:', err)
      }
    },

    tool: {
      'ability_list': tool({
        description: 'List all available abilities',
        args: {},
        async execute() {
          if (abilities.size === 0) return 'No abilities loaded.'
          
          const list = Array.from(abilities.values()).map(loaded => {
            const stepCount = loaded.ability.steps.length
            return `- **${loaded.ability.name}**: ${loaded.ability.description} (${stepCount} steps)`
          })
          
          return list.join('\n')
        },
      }),

      'ability_run': tool({
        description: `Execute an ability workflow. Available: ${Array.from(abilities.keys()).join(', ') || 'none loaded'}`,
        args: {
          name: tool.schema.string().describe('Ability name to run'),
          inputs: tool.schema.optional(tool.schema.any()).describe('Input values for the ability'),
        },
        async execute({ name, inputs = {} }, toolCtx) {
          return executeAbilityByName(
            name,
            inputs as Record<string, unknown>,
            { sessionID: toolCtx.sessionID, agent: toolCtx.agent }
          )
        },
      }),

      'ability_command': tool({
        description: 'Bridge bibliography slash commands to runtime abilities',
        args: {
          command: tool.schema.string().describe('Slash command name, e.g. /paper-screening or /bibliography'),
          arguments: tool.schema.string().optional().describe('Raw command arguments as plain text or JSON object string'),
        },
        async execute({ command, arguments: commandArguments }, toolCtx) {
          const parsedArgs = parseCommandInput(commandArguments)
          return executeBibliographyCommand(
            command,
            parsedArgs,
            { sessionID: toolCtx.sessionID, agent: toolCtx.agent }
          )
        },
      }),

      'ability_bibliography_scan': tool({
        description: 'Scan bibliography artifacts for audit issues',
        args: {},
        async execute() {
          const scan = await scanBibliographyArtifacts(bibliographyStore)
          return JSON.stringify(scan)
        },
      }),

      'ability_status': tool({
        description: 'Get status of active ability execution',
        args: {},
        async execute() {
          const execution = executionManager.getActive()
          if (!execution) {
            return JSON.stringify({ status: 'none', message: 'No active ability' })
          }

          const topic = resolveTopicFromExecution(execution)
          const state = await checkpointStore.loadState(topic)
          const focus = state
            ? renderFocusRefreshBlock(state, 'pre_high_impact_decision')
            : undefined

          return JSON.stringify({
            status: execution.status,
            ability: execution.ability.name,
            currentStep: execution.currentStep?.id,
            progress: `${execution.completedSteps.length}/${execution.ability.steps.length}`,
            topic,
            focus,
          })
        },
      }),

      'ability_context_detail': tool({
        description: 'Get selective detail reinjection block for current ability topic',
        args: {
          use_case: tool.schema.enum([
            'continue_implementation',
            'explain_reasoning',
            'recover_execution_context',
            'resolve_pending_work',
          ]).describe('Detail reinjection use case selector'),
        },
        async execute({ use_case }) {
          const execution = executionManager.getActive()
          if (!execution) {
            return JSON.stringify({ status: 'none', message: 'No active ability' })
          }

          const topic = resolveTopicFromExecution(execution)
          const detail = await checkpointStore.loadDetail(topic)
          if (!detail) {
            return JSON.stringify({
              status: 'missing',
              topic,
              use_case,
              message: 'No detail capsule found for current topic',
            })
          }

          const selected = selectDetailFields(detail, use_case as DetailUseCase)
          return JSON.stringify({
            status: 'ok',
            topic,
            use_case,
            selected,
            reinjection: renderDetailReinjectionBlock(topic, selected),
          })
        },
      }),

      'ability_coding_artifacts': tool({
        description: 'List or load coding workflow artifacts (task plans, validation reports, etc.)',
        args: {
          action: tool.schema.enum(['list', 'load']).describe('Action: list all or load specific'),
          type: tool.schema.optional(tool.schema.string()).describe('Artifact type filter'),
          key: tool.schema.optional(tool.schema.string()).describe('Artifact key for load'),
        },
        async execute({ action, type, key }) {
          const isValidType = (value: string): value is CodingArtifactType => {
            return CODING_ARTIFACT_TYPES.includes(value as CodingArtifactType)
          }

          if (action === 'list') {
            if (type) {
              if (!isValidType(type)) {
                return JSON.stringify({ status: 'error', message: `Unknown artifact type '${type}'` })
              }
              const items = await codingArtifactStore.list(type)
              return JSON.stringify({ status: 'ok', count: items.length, items })
            }

            const allByType = await Promise.all(
              CODING_ARTIFACT_TYPES.map(async (artifactType) => ({
                type: artifactType,
                keys: await codingArtifactStore.list(artifactType),
              }))
            )
            const count = allByType.reduce((acc, item) => acc + item.keys.length, 0)
            return JSON.stringify({ status: 'ok', count, items: allByType })
          }

          if (action === 'load' && type && key) {
            if (!isValidType(type)) {
              return JSON.stringify({ status: 'error', message: `Unknown artifact type '${type}'` })
            }
            const data = await codingArtifactStore.load(type, key)
            return JSON.stringify({ status: data ? 'ok' : 'not_found', data })
          }

          return JSON.stringify({ status: 'error', message: 'Invalid action or missing params' })
        },
      }),

      'ability_cancel': tool({
        description: 'Cancel the active ability execution',
        args: {},
        async execute() {
          const cancelled = executionManager.cancel()
          return JSON.stringify(cancelled
            ? { status: 'cancelled', message: 'Ability cancelled' }
            : { status: 'none', message: 'No active ability' })
        },
      }),
    },
  }
}

export default AbilitiesPlugin
