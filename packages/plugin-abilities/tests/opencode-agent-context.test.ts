import { describe, expect, it } from 'bun:test'
import { createOpencodeAgentContext } from '../src/runtime/opencode-agent-context.js'

describe('createOpencodeAgentContext', () => {
  it('uses OpenCode child sessions to satisfy agent calls', async () => {
    const calls: Array<{ type: string; payload: any }> = []

    const ctx = createOpencodeAgentContext({
      client: {
        session: {
          async create(options) {
            calls.push({ type: 'create', payload: options })
            return { data: { id: 'ses_child_1' } }
          },
          async prompt(options) {
            calls.push({ type: 'prompt', payload: options })
            return {
              data: {
                info: {
                  providerID: 'github-copilot',
                  modelID: 'gpt-5.3-codex',
                },
                parts: [
                  { type: 'reasoning', text: 'internal' },
                  { type: 'text', text: '{"ok":true}' },
                ],
              },
            }
          },
          async delete(options) {
            calls.push({ type: 'delete', payload: options })
            return { data: true }
          },
        },
      },
      directory: '/tmp/project',
      parentSessionID: 'ses_parent',
      agent: 'opencoder',
      model: {
        providerID: 'github-copilot',
        modelID: 'gpt-5.3-codex',
      },
    })

    const result = await ctx.call({
      agent: 'research-synthesizer',
      prompt: 'Return strict JSON only',
    })

    expect(result).toEqual({
      output: '{"ok":true}',
      provider: 'github-copilot',
      model: 'gpt-5.3-codex',
    })
    expect(calls.map((call) => call.type)).toEqual(['create', 'prompt', 'delete'])
    expect(calls[0].payload.body.parentID).toBe('ses_parent')
    expect(calls[1].payload.body.agent).toBe('opencoder')
    expect(calls[1].payload.body.model).toEqual({
      providerID: 'github-copilot',
      modelID: 'gpt-5.3-codex',
    })
    expect(calls[2].payload.path.id).toBe('ses_child_1')
  })

  it('throws when the child session returns no text output', async () => {
    const ctx = createOpencodeAgentContext({
      client: {
        session: {
          async create() {
            return { data: { id: 'ses_child_2' } }
          },
          async prompt() {
            return {
              data: {
                info: {
                  providerID: 'github-copilot',
                  modelID: 'gpt-5.3-codex',
                },
                parts: [],
              },
            }
          },
          async messages() {
            return { data: [] }
          },
          async delete() {
            return { data: true }
          },
        },
      },
      directory: '/tmp/project',
    })

    await expect(
      ctx.call({
        agent: 'research-synthesizer',
        prompt: 'Return strict JSON only',
      })
    ).rejects.toThrow('OpenCode agent prompt returned no text output')
  })

  it('falls back to session messages when prompt response omits parts', async () => {
    const ctx = createOpencodeAgentContext({
      client: {
        session: {
          async create() {
            return { data: { id: 'ses_child_3' } }
          },
          async prompt() {
            return { data: {} }
          },
          async messages() {
            return {
              data: [
                {
                  info: {
                    role: 'assistant',
                    providerID: 'github-copilot',
                    modelID: 'gpt-5.3-codex',
                  },
                  parts: [{ type: 'text', text: '{"fallback":true}' }],
                },
              ],
            }
          },
          async delete() {
            return { data: true }
          },
        },
      },
      directory: '/tmp/project',
    })

    await expect(
      ctx.call({
        agent: 'research-synthesizer',
        prompt: 'Return strict JSON only',
      })
    ).resolves.toEqual({
      output: '{"fallback":true}',
      provider: 'github-copilot',
      model: 'gpt-5.3-codex',
    })
  })
})
