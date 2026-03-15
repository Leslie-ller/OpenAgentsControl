import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import AbilitiesPlugin from '../src/opencode-plugin.js'

type AbilityRunPayload = {
  status: string
  execution?: {
    status: string
    id: string
  }
  ability?: string
  result?: string
  control?: {
    gate: {
      verdict: 'allow' | 'warn' | 'block'
    }
    midRunGate: {
      latest: { verdict: 'allow' | 'warn' | 'block' } | null
      history: Array<{ verdict: 'allow' | 'warn' | 'block' }>
    }
    obligations: {
      obligations: Array<{
        key: string
        status: string
        severity: string
      }>
    }
    modelAudit?: {
      observed: number
      driftCount: number
      drifts: Array<{
        drifted: boolean
        expectedModel?: string
        actualModel?: string
      }>
    }
    eventCount: number
  }
}

async function createPluginFor(tempDir: string) {
  return AbilitiesPlugin({
    directory: tempDir,
  } as any)
}

function writeAbility(tempDir: string, dirName: string, contents: string): void {
  const abilityDir = path.join(tempDir, '.opencode', 'abilities', dirName)
  fs.mkdirSync(abilityDir, { recursive: true })
  fs.writeFileSync(path.join(abilityDir, 'ability.yaml'), contents)
}

function parseToolResponse(raw: string): AbilityRunPayload {
  return JSON.parse(raw) as AbilityRunPayload
}

describe('opencode plugin ability.run control enforcement', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-plugin-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('returns failed status when execution completes but gate blocks', async () => {
    writeAbility(
      tempDir,
      'block-missing-tests',
      `
name: block-missing-tests
description: Completes execution but misses hard obligations
steps:
  - id: implement
    type: script
    run: echo "changed code"
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'block-missing-tests' })
    const result = parseToolResponse(raw)

    expect(result.status).toBe('failed')
    expect(result.execution?.status).toBe('completed')
    expect(result.control?.gate.verdict).toBe('block')
    expect(result.control?.obligations.obligations.some((item) => item.key === 'run_tests')).toBe(true)
    expect(result.control?.eventCount).toBeGreaterThan(0)
  })

  test('keeps warn as successful while exposing gate details', async () => {
    writeAbility(
      tempDir,
      'warn-no-commit',
      `
name: warn-no-commit
description: Satisfies hard obligations but leaves soft commit warning
steps:
  - id: execute-suite
    type: script
    run: echo "suite"
    tags:
      - test
    validation:
      exit_code: 0
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'warn-no-commit' })
    const result = parseToolResponse(raw)

    expect(result.status).toBe('completed')
    expect(result.execution?.status).toBe('completed')
    expect(result.control?.gate.verdict).toBe('warn')
    expect(result.control?.midRunGate.latest?.verdict).toBe('warn')
  })

  test('returns completed status when allow gate is satisfied', async () => {
    writeAbility(
      tempDir,
      'allow-control-pass',
      `
name: allow-control-pass
description: Satisfies all current MVP obligations
steps:
  - id: execute-suite
    type: script
    run: echo "suite"
    tags:
      - test
    validation:
      exit_code: 0
  - id: persist-changes
    type: script
    run: echo "saved metadata"
    tags:
      - commit
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'allow-control-pass' })
    const result = parseToolResponse(raw)

    expect(result.status).toBe('completed')
    expect(result.execution?.status).toBe('completed')
    expect(result.control?.gate.verdict).toBe('allow')
    expect(result.control?.midRunGate.latest?.verdict).toBe('allow')
    expect(result.control?.midRunGate.history.length).toBeGreaterThan(0)
  })

  test('stops early when mid-run gate blocks a continued workflow', async () => {
    writeAbility(
      tempDir,
      'mid-run-stop',
      `
name: mid-run-stop
description: Validation fails and should stop before commit step
steps:
  - id: execute-suite
    type: script
    run: exit 1
    tags:
      - test
    on_failure: continue
    validation:
      exit_code: 0

  - id: persist-changes
    type: script
    run: echo "saved metadata"
    tags:
      - commit
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'mid-run-stop' })
    const result = parseToolResponse(raw)
    const commitObligation = result.control?.obligations.obligations.find((item) => item.key === 'commit_if_required')

    expect(result.status).toBe('failed')
    expect(result.execution?.status).toBe('failed')
    expect(result.control?.gate.verdict).toBe('block')
    expect(result.control?.midRunGate.latest?.verdict).toBe('block')
    expect(commitObligation?.status).not.toBe('satisfied')
    expect(result.result).not.toContain('persist-changes')
  })

  test('executes agent steps through session command and records model audit', async () => {
    writeAbility(
      tempDir,
      'agent-review',
      `
name: agent-review
description: Uses a real agent step
steps:
  - id: review
    type: agent
    agent: reviewer
    model: gpt-5.4
    provider: openai
    prompt: Review the implementation
`
    )

    const calls: Array<{
      path: { id: string }
      body: { command: string; arguments: string; agent?: string; model?: string }
    }> = []

    const plugin = await AbilitiesPlugin({
      directory: tempDir,
      client: {
        session: {
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
        },
      },
    } as any)

    const raw = await plugin.tool['ability.run'].execute({ name: 'agent-review' })
    const result = parseToolResponse(raw)

    expect(result.status).toBe('failed')
    expect(result.execution?.status).toBe('completed')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body.command).toBe('task')
    expect(result.control?.modelAudit?.observed).toBe(1)
    expect(result.control?.modelAudit?.driftCount).toBe(0)
    expect(result.control?.modelAudit?.drifts[0]?.expectedModel).toBe('gpt-5.4')
    expect(result.control?.modelAudit?.drifts[0]?.actualModel).toBe('gpt-5.4')
  })

  test('uses declared ability task_type instead of hardcoded code_change', async () => {
    writeAbility(
      tempDir,
      'research-capture',
      `
name: research-capture
description: Capture a paper into the research system
task_type: research_capture
steps:
  - id: collect
    type: script
    run: echo "paper collected"
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'research-capture' })
    const result = parseToolResponse(raw)

    expect(result.control?.obligations.taskType).toBe('research_capture')
    expect(result.control?.gate.verdict).toBe('block')
    expect(result.status).toBe('failed')
  })

  test('allows research_capture abilities that satisfy source and summary obligations', async () => {
    writeAbility(
      tempDir,
      'research-capture-pass',
      `
name: research-capture-pass
description: Capture a paper with source and summary evidence
task_type: research_capture
steps:
  - id: record-paper-source
    type: script
    run: echo "doi:10.1000/test"
    tags:
      - source
  - id: save-paper-summary
    type: script
    run: echo "summary saved"
    tags:
      - summary
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'research-capture-pass' })
    const result = parseToolResponse(raw)

    expect(result.control?.obligations.taskType).toBe('research_capture')
    expect(result.control?.gate.verdict).toBe('allow')
    expect(result.status).toBe('completed')
    expect(result.execution?.status).toBe('completed')
  })

  test('allows paper_screening abilities that satisfy screening obligations', async () => {
    writeAbility(
      tempDir,
      'paper-screening-pass',
      `
name: paper-screening-pass
description: Screen a candidate paper
task_type: paper_screening
steps:
  - id: record-paper-source
    type: script
    run: echo "doi:10.1000/test"
    tags:
      - source
  - id: classify-paper-role
    type: script
    run: echo "core support"
    tags:
      - role
  - id: record-screening-decision
    type: script
    run: echo "keep for fulltext review"
    tags:
      - decision
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'paper-screening-pass' })
    const result = parseToolResponse(raw)

    expect(result.control?.obligations.taskType).toBe('paper_screening')
    expect(result.control?.gate.verdict).toBe('allow')
    expect(result.status).toBe('completed')
  })

  test('blocks paper_fulltext_review abilities when review obligations are incomplete', async () => {
    writeAbility(
      tempDir,
      'paper-fulltext-review-block',
      `
name: paper-fulltext-review-block
description: Review a paper but miss structured judgment
task_type: paper_fulltext_review
steps:
  - id: record-paper-source
    type: script
    run: echo "doi:10.1000/test"
    tags:
      - source
  - id: save-paper-summary
    type: script
    run: echo "summary saved"
    tags:
      - summary
`
    )

    const plugin = await createPluginFor(tempDir)
    const raw = await plugin.tool['ability.run'].execute({ name: 'paper-fulltext-review-block' })
    const result = parseToolResponse(raw)

    expect(result.control?.obligations.taskType).toBe('paper_fulltext_review')
    expect(result.control?.gate.verdict).toBe('block')
    expect(result.status).toBe('failed')
  })
})
