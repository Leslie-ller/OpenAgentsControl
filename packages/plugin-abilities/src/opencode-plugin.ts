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
import { createCheckpointStore } from './runtime/context/checkpoint-store.js'
import { createCompactionCheckpoint } from './runtime/context/compaction-checkpoint.js'
import { renderFocusRefreshBlock } from './runtime/context/focus-refresh.js'
import { PendingCheckpointSummaries } from './runtime/context/pending-checkpoint-summaries.js'
import { resolveTopicFromExecution } from './runtime/context/topic-resolver.js'
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
  'ability.list',
  'ability.status',
  'ability.cancel',
  'read',
  'glob',
  'grep',
]

export const AbilitiesPlugin: Plugin = async (ctx) => {
  const abilities = new Map<string, LoadedAbility>()
  const pendingCheckpointSummaries = new PendingCheckpointSummaries()

  // Initialize control event infrastructure
  const controlLogDir = join(ctx.directory, '.opencode', 'control-logs')
  const eventLog = new EventLog({ logDir: controlLogDir })
  const eventBus = new ControlEventBus({ log: eventLog })
  const executionManager = new ExecutionManager(eventBus)
  const bibliographyStore = createBibliographyStore(ctx.directory)
  const bibliographyPipeline = new BibliographyPipeline(bibliographyStore)
  const checkpointStore = createCheckpointStore(ctx.directory)

  const abilitiesDir = `${ctx.directory}/.opencode/abilities`

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

  const createExecutorContext = (): ExecutorContext => {
    return {
      cwd: ctx.directory,
      env: {},
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

  const executeAbilityByName = async (name: string, inputs: Record<string, unknown> = {}) => {
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
        createExecutorContext()
      )

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

  const executeBibliographyCommand = async (command: string, args: Record<string, unknown>) => {
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
        createExecutorContext(),
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
        const sessionID = (input as any)?.message?.sessionID
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
            injections.push(renderFocusRefreshBlock(state, 'pre_high_impact_decision'))
          }

          injections.push(buildAbilityContextInjection(activeExecution))
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
          executionManager.cleanup()
          eventBus.reset()
        }
      } catch (err) {
        console.error('[abilities] event handler error:', err)
      }
    },

    tool: {
      'ability.list': tool({
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

      'ability.run': tool({
        description: `Execute an ability workflow. Available: ${Array.from(abilities.keys()).join(', ') || 'none loaded'}`,
        args: {
          name: tool.schema.string().describe('Ability name to run'),
          inputs: tool.schema.optional(tool.schema.any()).describe('Input values for the ability'),
        },
        async execute({ name, inputs = {} }) {
          return executeAbilityByName(name, inputs as Record<string, unknown>)
        },
      }),

      'ability.command': tool({
        description: 'Bridge bibliography slash commands to runtime abilities',
        args: {
          command: tool.schema.string().describe('Slash command name, e.g. /paper-screening or /bibliography'),
          arguments: tool.schema.string().optional().describe('Raw command arguments as plain text or JSON object string'),
        },
        async execute({ command, arguments: commandArguments }) {
          const parsedArgs = parseCommandInput(commandArguments)
          return executeBibliographyCommand(command, parsedArgs)
        },
      }),

      'ability.bibliography.scan': tool({
        description: 'Scan bibliography artifacts for audit issues',
        args: {},
        async execute() {
          const scan = await scanBibliographyArtifacts(bibliographyStore)
          return JSON.stringify(scan)
        },
      }),

      'ability.status': tool({
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

      'ability.cancel': tool({
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
