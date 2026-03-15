import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'
import type { Ability, AbilityExecution, LoadedAbility, ExecutorContext } from './types/index.js'
import { loadAbilities } from './loader/index.js'
import { validateAbility, validateInputs } from './validator/index.js'
import { formatExecutionResult } from './executor/index.js'
import { ExecutionManager } from './executor/execution-manager.js'
import { evaluateCompletionGate, evaluateModelDrift, evaluateObligations, MidRunGateMonitor } from './control/index.js'
import { ControlEventBus } from './control/event-bus.js'
import { createEventCallbacks } from './control/event-adapter.js'

type SessionCommandResponse = {
  data?: {
    info?: {
      model?: string
      providerID?: string
      provider?: { id?: string }
    }
    parts?: Array<{
      type?: string
      text?: string
    }>
  }
}

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
  const executionManager = new ExecutionManager()

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

  const resolveSessionId = async (): Promise<string> => {
    const client = (ctx as any).client
    const sessions = await client?.session?.list?.()
    const sessionId = sessions?.[0]?.id

    if (!sessionId) {
      throw new Error('No active OpenCode session available for agent execution')
    }

    return sessionId
  }

  const formatTaskArguments = (options: { agent: string; prompt: string }): string => {
    const escapedPrompt = JSON.stringify(options.prompt)
    const escapedAgent = JSON.stringify(options.agent)
    return `subagent_type=${escapedAgent} prompt=${escapedPrompt}`
  }

  const extractAgentOutput = (response: SessionCommandResponse | unknown) => {
    const data = (response as SessionCommandResponse | undefined)?.data
    const text = data?.parts
      ?.filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text ?? '')
      .join('\n')
      .trim()

    return {
      output: text || '[Agent invocation completed with no text output]',
      model: data?.info?.model,
      provider: data?.info?.providerID ?? data?.info?.provider?.id,
    }
  }

  const createExecutorContext = (
    bus?: ControlEventBus,
    options?: { midRunGate?: MidRunGateMonitor; enforceMidRunGate?: boolean }
  ): ExecutorContext => {
    const client = (ctx as any).client

    return {
      cwd: ctx.directory,
      env: {},
      agents: client?.session?.command
        ? {
            async call(agentOptions) {
              const sessionId = await resolveSessionId()
              const response = await client.session.command({
                path: { id: sessionId },
                body: {
                  command: 'task',
                  arguments: formatTaskArguments(agentOptions),
                  agent: agentOptions.agent,
                  model: agentOptions.model,
                },
              })

              return extractAgentOutput(response)
            },
            async background(agentOptions) {
              const sessionId = await resolveSessionId()
              const response = await client.session.command({
                path: { id: sessionId },
                body: {
                  command: 'background_task',
                  arguments: formatTaskArguments(agentOptions),
                  agent: agentOptions.agent,
                  model: agentOptions.model,
                },
              })

              return extractAgentOutput(response)
            },
          }
        : undefined,
      ...(bus ? createEventCallbacks(bus) : {}),
      shouldAbort: options?.enforceMidRunGate
        ? () => {
            const latest = options.midRunGate?.getLatest()
            if (latest && latest.failed.length > 0) {
              return {
                abort: true,
                reason: `Control gate blocked execution: ${latest.reasons.map((reason) => reason.message).join('; ')}`,
              }
            }

            return { abort: false }
          }
        : undefined,
    }
  }

  const buildAbilityContextInjection = (execution: AbilityExecution): string => {
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

  return {
    // Hook: Inject ability context into every chat message
    async 'chat.message'(_input, output) {
      try {
        const activeExecution = executionManager.getActive()

        if (activeExecution && activeExecution.status === 'running') {
          output.parts.unshift({
            type: 'text',
            text: buildAbilityContextInjection(activeExecution),
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
        if (event.type === 'session.deleted') {
          executionManager.cleanup()
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
          const loaded = abilities.get(name)
          if (!loaded) {
            return JSON.stringify({ error: `Ability '${name}' not found` })
          }

          const ability = loaded.ability
          
          // Validate inputs
          const inputErrors = validateInputs(ability, inputs as Record<string, unknown>)
          if (inputErrors.length > 0) {
            return JSON.stringify({ 
              error: 'Input validation failed', 
              details: inputErrors.map(e => e.message) 
            })
          }

          try {
            // TODO: Derive taskType from ability definition or execution context
            // when multiple TaskTypes are supported. Currently hardcoded to
            // 'code_change' as it is the only supported type.
            const taskType = 'code_change' as const

            // Create a per-run event bus and wire it into the executor context
            // so events are emitted in real-time (replacing post-hoc replay).
            const bus = new ControlEventBus(`run_${Date.now()}`, taskType)
            const midRunGate = new MidRunGateMonitor(bus, taskType)
            const execution = await executionManager.execute(
              ability, 
              inputs as Record<string, unknown>, 
              createExecutorContext(bus, {
                midRunGate,
                enforceMidRunGate: true,
              })
            )

            // Read the accumulated event log from the bus
            const events = bus.getLog()
            const obligations = evaluateObligations(events, taskType)
            const gate = midRunGate.getLatest() ?? evaluateCompletionGate(obligations)
            const modelAudit = evaluateModelDrift(events)
            const finalStatus = gate.verdict === 'block' ? 'failed' : execution.status
            
            return JSON.stringify({
              status: finalStatus,
              execution: {
                status: execution.status,
                id: execution.id,
              },
              ability: ability.name,
              result: formatExecutionResult(execution),
              control: {
                gate,
                midRunGate: midRunGate.getState(),
                obligations,
                modelAudit,
                eventCount: events.length,
              },
            })
          } catch (error) {
            return JSON.stringify({ 
              status: 'error', 
              error: error instanceof Error ? error.message : String(error) 
            })
          }
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

          return JSON.stringify({
            status: execution.status,
            ability: execution.ability.name,
            currentStep: execution.currentStep?.id,
            progress: `${execution.completedSteps.length}/${execution.ability.steps.length}`,
          })
        },
      }),

      'ability.cancel': tool({
        description: 'Cancel the active ability execution',
        args: {},
        async execute() {
          const cancelled = executionManager.cancelActive()
          return JSON.stringify(cancelled
            ? { status: 'cancelled', message: 'Ability cancelled' }
            : { status: 'none', message: 'No active ability' })
        },
      }),
    },
  }
}

export default AbilitiesPlugin
