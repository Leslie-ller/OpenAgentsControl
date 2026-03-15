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
})
