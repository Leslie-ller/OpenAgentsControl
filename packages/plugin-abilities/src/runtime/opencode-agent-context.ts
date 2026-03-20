import type { AgentCallOptions, AgentContext, AgentCallReturn } from '../types/index.js'

type OpencodeSessionPromptResponse = {
  data?: {
    info?: {
      modelID?: string
      providerID?: string
      error?: { data?: { message?: string } }
    }
    parts?: Array<{
      type?: string
      text?: string
    }>
  }
}

type OpencodeSessionMessagesResponse = {
  data?: Array<{
    info?: {
      role?: string
      modelID?: string
      providerID?: string
      error?: { data?: { message?: string } }
    }
    parts?: Array<{
      type?: string
      text?: string
    }>
  }>
}

type OpencodeClientLike = {
  session: {
    create: (options: {
      body?: { parentID?: string; title?: string }
      query?: { directory?: string }
    }) => Promise<{ data?: { id?: string } }>
    prompt: (options: {
      path: { id: string }
      body: {
        agent?: string
        model?: { providerID: string; modelID: string }
        noReply?: boolean
        system?: string
        parts: Array<{ type: 'text'; text: string }>
      }
      query?: { directory?: string }
    }) => Promise<OpencodeSessionPromptResponse>
    messages?: (options: {
      path: { id: string }
      query?: { directory?: string }
    }) => Promise<OpencodeSessionMessagesResponse>
    delete?: (options: {
      path: { id: string }
      query?: { directory?: string }
    }) => Promise<unknown>
  }
}

export interface OpencodeAgentContextOptions {
  client: OpencodeClientLike
  directory: string
  parentSessionID?: string
  agent?: string
  model?: { providerID: string; modelID: string }
  cleanupSession?: boolean
  system?: string
}

const DEFAULT_SYSTEM =
  'You are being called as a workflow sub-agent. Return only the final answer requested by the prompt. Do not use tools unless the prompt explicitly requires them.'

function extractOutput(response: OpencodeSessionPromptResponse): string {
  const parts = response.data?.parts ?? []
  const text = parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join('\n\n')

  if (text) return text

  const errorMessage = response.data?.info?.error?.data?.message
  if (typeof errorMessage === 'string' && errorMessage.trim()) {
    throw new Error(errorMessage.trim())
  }

  throw new Error('OpenCode agent prompt returned no text output')
}

async function resolvePromptOutput(
  client: OpencodeClientLike,
  sessionID: string,
  directory: string,
  response: OpencodeSessionPromptResponse
): Promise<AgentCallReturn> {
  try {
    return {
      output: extractOutput(response),
      model: response.data?.info?.modelID,
      provider: response.data?.info?.providerID,
    }
  } catch (error) {
    if (!client.session.messages) throw error

    const messages = await client.session.messages({
      path: { id: sessionID },
      query: { directory },
    })
    const assistant = [...(messages.data ?? [])]
      .reverse()
      .find((message) => message.info?.role === 'assistant')

    const fallbackResponse: OpencodeSessionPromptResponse = {
      data: {
        info: assistant?.info,
        parts: assistant?.parts,
      },
    }

    return {
      output: extractOutput(fallbackResponse),
      model: assistant?.info?.modelID,
      provider: assistant?.info?.providerID,
    }
  }
}

export function createOpencodeAgentContext(
  options: OpencodeAgentContextOptions
): AgentContext {
  return {
    async call(callOptions: AgentCallOptions): Promise<AgentCallReturn> {
      const requestedAgent = typeof callOptions.agent === 'string' && callOptions.agent.trim().length > 0
        ? callOptions.agent
        : options.agent

      const created = await options.client.session.create({
        body: {
          parentID: options.parentSessionID,
          title: `Ability agent: ${requestedAgent ?? 'default'}`,
        },
        query: { directory: options.directory },
      })

      const sessionID = created.data?.id
      if (!sessionID) {
        throw new Error('Failed to create OpenCode child session for agent step')
      }

      try {
        const promptResponse = await options.client.session.prompt({
          path: { id: sessionID },
          query: { directory: options.directory },
          body: {
            agent: requestedAgent,
            model: options.model,
            noReply: false,
            system: options.system ?? DEFAULT_SYSTEM,
            parts: [{ type: 'text', text: callOptions.prompt }],
          },
        })

        return await resolvePromptOutput(
          options.client,
          sessionID,
          options.directory,
          promptResponse
        )
      } finally {
        if (options.cleanupSession === false || !options.client.session.delete) return
        try {
          await options.client.session.delete({
            path: { id: sessionID },
            query: { directory: options.directory },
          })
        } catch {
          // Best-effort cleanup only.
        }
      }
    },
  }
}
