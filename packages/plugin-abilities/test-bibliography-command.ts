#!/usr/bin/env bun

import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { AbilitiesPlugin } from './src/opencode-plugin.js'

async function writeSyntheticAbility(
  baseDir: string,
  segments: string[],
  yaml: string
): Promise<void> {
  const dir = path.join(baseDir, ...segments)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'ability.yaml'), yaml, 'utf-8')
}

function buildAgentResponse() {
  return {
    data: {
      info: {
        providerID: 'github-copilot',
        modelID: 'gpt-5.3-codex',
      },
      parts: [
        {
          type: 'text',
          text: JSON.stringify({
            paper_key: 'PAPER1',
            title: 'Synthetic Agent Reading Card',
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
          }),
        },
      ],
    },
  }
}

async function main() {
  const command = process.argv[2] ?? '/paper-fulltext-review'
  const rawArguments = process.argv[3] ?? '{"zotero_key":"PAPER1"}'
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'plugin-abilities-command-'))
  const abilitiesDir = path.join(tmpDir, '.opencode', 'abilities', 'research')
  const calls: Array<{ type: string; payload: unknown }> = []

  try {
    await writeSyntheticAbility(
      abilitiesDir,
      ['bibliography-plan'],
      [
        'name: research/bibliography-plan',
        'description: synthetic plan ability',
        'task_type: bibliography_plan',
        'inputs:',
        '  topic:',
        '    type: string',
        '    required: true',
        'steps:',
        '  - id: generate-plan',
        '    type: script',
        '    run: echo "{\\"topic\\":\\"{{inputs.topic}}\\"}"',
      ].join('\n')
    )

    await writeSyntheticAbility(
      abilitiesDir,
      ['paper-screening'],
      [
        'name: research/paper-screening',
        'description: synthetic screening ability',
        'task_type: paper_screening',
        'inputs:',
        '  query:',
        '    type: string',
        '    required: true',
        'steps:',
        '  - id: record-screening-decision',
        '    type: script',
        '    run: echo "{\\"items\\":[{\\"paper_key\\":\\"p1\\",\\"title\\":\\"P1\\",\\"decision\\":\\"keep\\",\\"reason\\":\\"r\\"}],\\"sufficiency_score\\":0.8,\\"anchors_count\\":2,\\"uncertainty_level\\":\\"low\\",\\"source_stage\\":\\"screening\\"}"',
      ].join('\n')
    )

    await writeSyntheticAbility(
      abilitiesDir,
      ['paper-fulltext-review'],
      [
        'name: research/paper-fulltext-review',
        'description: synthetic review ability',
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
      ].join('\n')
    )

    const plugin = await AbilitiesPlugin({
      directory: tmpDir,
      worktree: tmpDir,
      client: {
        session: {
          async create(options: unknown) {
            calls.push({ type: 'create', payload: options })
            return { data: { id: 'ses_child_1' } }
          },
          async prompt(options: unknown) {
            calls.push({ type: 'prompt', payload: options })
            return buildAgentResponse()
          },
          async messages(options: unknown) {
            calls.push({ type: 'messages', payload: options })
            return { data: [] }
          },
          async delete(options: unknown) {
            calls.push({ type: 'delete', payload: options })
            return { data: true }
          },
        },
      },
    } as any)

    const result = await plugin.tool['ability.command'].execute(
      {
        command,
        arguments: rawArguments,
      },
      {
        sessionID: 'ses_parent',
        agent: 'opencoder',
      } as any
    )

    console.log('ability.command result:')
    console.log(result)
    console.log('\nOpenCode session call trace:')
    console.log(JSON.stringify(calls, null, 2))
    console.log(`\nSynthetic fixture root: ${tmpDir}`)
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
