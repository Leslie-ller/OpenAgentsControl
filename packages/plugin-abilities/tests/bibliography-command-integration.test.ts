import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AbilitiesSDK } from '../src/sdk.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('bibliography command integration', () => {
  let tmpDir: string
  let abilitiesDir: string
  let sdk: AbilitiesSDK

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bib-command-int-'))
    abilitiesDir = path.join(tmpDir, '.opencode', 'abilities', 'research')

    await fs.mkdir(path.join(abilitiesDir, 'bibliography-plan'), { recursive: true })
    await fs.mkdir(path.join(abilitiesDir, 'paper-screening'), { recursive: true })
    await fs.mkdir(path.join(abilitiesDir, 'paper-fulltext-review'), { recursive: true })
    await fs.mkdir(path.join(abilitiesDir, 'section-evidence-pack'), { recursive: true })

    await fs.writeFile(
      path.join(abilitiesDir, 'bibliography-plan', 'ability.yaml'),
      [
        'name: research/bibliography-plan',
        'description: test plan',
        'task_type: bibliography_plan',
        'inputs:',
        '  topic:',
        '    type: string',
        '    required: true',
        'steps:',
        '  - id: generate-plan',
        '    type: script',
        '    run: echo "{\\"topic\\":\\"{{inputs.topic}}\\"}"',
      ].join('\n'),
      'utf-8'
    )

    await fs.writeFile(
      path.join(abilitiesDir, 'paper-screening', 'ability.yaml'),
      [
        'name: research/paper-screening',
        'description: test screening',
        'task_type: paper_screening',
        'inputs:',
        '  query:',
        '    type: string',
        '    required: true',
        'steps:',
        '  - id: record-screening-decision',
        '    type: script',
        '    run: echo "{\\"items\\":[{\\"paper_key\\":\\"p1\\",\\"title\\":\\"P1\\",\\"decision\\":\\"keep\\",\\"reason\\":\\"r\\"}],\\"sufficiency_score\\":0.8,\\"anchors_count\\":2,\\"uncertainty_level\\":\\"low\\",\\"source_stage\\":\\"screening\\"}"',
        '    tags: [screening-decision, task-sufficiency-check, evidence-grounding, uncertainty-annotation, artifact-lineage]',
      ].join('\n'),
      'utf-8'
    )

    await fs.writeFile(
      path.join(abilitiesDir, 'paper-fulltext-review', 'ability.yaml'),
      [
        'name: research/paper-fulltext-review',
        'description: test review',
        'task_type: paper_fulltext_review',
        'inputs:',
        '  zotero_key:',
        '    type: string',
        '    required: true',
        'steps:',
        '  - id: read-zotero-pdf',
        '    type: script',
        '    run: echo "{\\"paper_key\\":\\"{{inputs.zotero_key}}\\",\\"clean_text\\":\\"A method-focused paper\\",\\"source_text_length\\":1200}"',
        '    tags: [fulltext-extract]',
        '  - id: record-reading-card',
        '    type: agent',
        '    agent: research-synthesizer',
        '    prompt: "Return a structured reading card"',
        '    needs: [read-zotero-pdf]',
        '    tags: [reading-card, task-sufficiency-check, evidence-grounding, uncertainty-annotation, artifact-lineage]',
      ].join('\n'),
      'utf-8'
    )

    await fs.writeFile(
      path.join(abilitiesDir, 'section-evidence-pack', 'ability.yaml'),
      [
        'name: research/section-evidence-pack',
        'description: test evidence pack',
        'task_type: section_evidence_pack',
        'inputs:',
        '  section:',
        '    type: string',
        '    required: true',
        'steps:',
        '  - id: record-evidence-pack',
        '    type: script',
        '    run: |',
        '      python3 - <<\'PY\'',
        '      raise SystemExit("No decision artifacts available for section {{inputs.section}}")',
        '      PY',
      ].join('\n'),
      'utf-8'
    )

    sdk = new AbilitiesSDK({
      projectDir: path.join(tmpDir, '.opencode', 'abilities'),
      includeGlobal: false,
      agents: {
        async call() {
          return JSON.stringify({
            paper_key: 'PAPER1',
            title: 'Agent reading card',
            summary: 'Agent synthesized summary',
            key_findings: ['f1', 'f2', 'f3'],
            methodology: 'MILP',
            relevance_notes: 'Relevant to thesis',
            anchors_count: 2,
            sufficiency_score: 0.8,
            uncertainty_level: 'moderate',
            source_text_length: 1200,
            source_excerpt: 'excerpt',
            source_stage: 'review',
            stage: 'full-review',
          })
        },
      },
    })
  })

  afterEach(async () => {
    sdk.cleanup()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('executes /bibliography plan via pipeline and returns artifact fields', async () => {
    const result = await sdk.executeCommand('/bibliography', '{"stage":"plan","payload":"agent safety"}')

    expect(result.error).toBeUndefined()
    expect(result.stage).toBe('plan')
    expect(result.execution?.status).toBe('completed')
    expect(result.artifact?.meta).not.toBeNull()
    expect(result.artifact?.data).not.toBeNull()
  })

  it('executes /paper-screening and persists per-paper artifact', async () => {
    const result = await sdk.executeCommand('/paper-screening', '{"query":"agent safety"}')

    expect(result.error).toBeUndefined()
    expect(result.stage).toBe('screening')
    expect(result.execution?.status).toBe('completed')
    expect(result.artifact?.artifacts.length).toBe(1)
    expect(result.artifact?.key).toBe('p1')
    expect(result.artifact?.batchKey).toBe('agent_safety')

    const storedPath = path.join(
      tmpDir,
      '.opencode',
      'bibliography-data',
      'screening',
      'p1.json'
    )
    await expect(fs.access(storedPath)).resolves.toBeNull()
  })

  it('surfaces stage failure reasons for command execution', async () => {
    const result = await sdk.executeCommand('/section-evidence-pack', '{"section":"methods"}')

    expect(result.stage).toBe('evidence-pack')
    expect(result.execution?.status).toBe('failed')
    expect(result.execution?.failedStepId).toBe('record-evidence-pack')
    expect(result.execution?.error).toContain('No decision artifacts available for section methods')
    expect(result.error).toContain('No decision artifacts available for section methods')
    expect(result.artifact?.meta).toBeNull()
  })

  it('threads agent context into command execution for review abilities', async () => {
    const result = await sdk.executeCommand('/paper-fulltext-review', '{"zotero_key":"PAPER1"}')

    expect(result.error).toBeUndefined()
    expect(result.stage).toBe('review')
    expect(result.execution?.status).toBe('completed')
    expect((result.artifact?.data as any).summary).toBe('Agent synthesized summary')
    expect((result.artifact?.data as any).methodology).toBe('MILP')
  })
})
