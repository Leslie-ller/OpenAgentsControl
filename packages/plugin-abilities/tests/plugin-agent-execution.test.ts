import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createAbilitiesPlugin } from '../src/plugin.js'

describe('full plugin agent step execution', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abilities-full-plugin-test-'))
    const abilityDir = path.join(tempDir, 'agent-review')
    fs.mkdirSync(abilityDir, { recursive: true })
    fs.writeFileSync(
      path.join(abilityDir, 'ability.yaml'),
      `
name: agent-review
description: Execute a real agent review step
steps:
  - id: review
    type: agent
    agent: reviewer
    model: gpt-5.4
    provider: openai
    prompt: Review the implementation
`
    )
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('routes agent steps through OpenCode task command', async () => {
    const calls: Array<{
      path: { id: string }
      body: { command: string; arguments: string; agent?: string; model?: string }
    }> = []

    const plugin = await createAbilitiesPlugin(
      {
        directory: tempDir,
        worktree: tempDir,
        client: {
          session: {
            get: async () => ({}),
            list: async () => [{ id: 'session-1' }],
            command: async (options: any) => {
              calls.push(options)
              return {
                data: {
                  info: { model: 'gpt-5.4', providerID: 'openai' },
                  parts: [{ type: 'text', text: 'agent review complete' }],
                },
              }
            },
            prompt: async () => ({}),
            todo: async () => ({}),
          },
          events: {
            publish: async () => {},
          },
        },
        $: () => ({ text: async () => '' }),
      } as any,
      {
        abilities: {
          directories: [tempDir],
        },
      }
    )

    const result = await plugin.tool['ability.run'].execute({ name: 'agent-review' })

    expect(result.status).toBe('completed')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.path.id).toBe('session-1')
    expect(calls[0]?.body.command).toBe('task')
    expect(calls[0]?.body.agent).toBe('reviewer')
    expect(calls[0]?.body.model).toBe('gpt-5.4')
    expect(calls[0]?.body.arguments).toContain('subagent_type="reviewer"')
    expect(calls[0]?.body.arguments).toContain('prompt="Review the implementation"')
  })
})
