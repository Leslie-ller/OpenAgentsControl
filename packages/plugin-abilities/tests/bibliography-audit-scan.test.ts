import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { BibliographyStore } from '../src/bibliography/store.js'
import { scanBibliographyArtifacts } from '../src/bibliography/audit-scan.js'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

describe('scanBibliographyArtifacts', () => {
  let tmpDir: string
  let store: BibliographyStore

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bib-audit-scan-'))
    store = new BibliographyStore({ dataDir: tmpDir })
  })

  afterEach(async () => {
    await store.clear()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns machine-readable findings with severity and artifact references', async () => {
    await store.save('screening', 'p1', {
      paper_key: 'p1',
      title: 'Paper 1',
      decision: 'keep',
      reason: 'relevant',
      role: 'core support',
    })

    await store.save('reading-card', 'p1', {
      paper_key: 'p1',
      title: 'Paper 1',
      summary: 'summary',
      key_findings: ['f1'],
      claim_impact: 'high',
      anchors_count: 0,
      stage: 'full-review',
      sufficiency_score: 0.5,
    })

    await store.save('decision', 'p1', {
      paper_key: 'p1',
      title: 'Paper 1',
      decision: 'keep',
      rationale: 'strong relevance',
      used_for_citation: true,
    })

    const result = await scanBibliographyArtifacts(store)

    expect(result.findings.length).toBeGreaterThanOrEqual(3)
    expect(result.totals.findings).toBe(result.findings.length)

    const hasError = result.findings.some((f) => f.severity === 'error' && f.artifactType === 'reading-card')
    const hasWarning = result.findings.some((f) => f.severity === 'warning' && f.artifactType === 'screening')
    const hasInfo = result.findings.some((f) => f.severity === 'info' && f.artifactType === 'decision')

    expect(hasError).toBe(true)
    expect(hasWarning).toBe(true)
    expect(hasInfo).toBe(true)
  })

  it('flags legacy placeholder and serialized-payload artifacts', async () => {
    await store.save('screening', 'paper_001', {
      paper_key: 'paper_001',
      title: 'agent safety - core methods paper',
      decision: 'keep',
      reason: 'template artifact',
    })

    await store.save('reading-card', 'paper_001', {
      paper_key: 'paper_001',
      title: 'Reading card for paper_001',
      summary: 'Full-text reviewed with traceable anchors.',
      key_findings: ['Finding A with section anchor'],
      anchors_count: 3,
      sufficiency_score: 0.81,
      stage: 'full-review',
    })

    await store.save('reading-card', 'x47f6ikw', {
      paper_key: 'X47F6IKW',
      title: 'Reading card for X47F6IKW',
      summary: JSON.stringify({
        item_key: 'X47F6IKW',
        attachment_key: 'JL2KGR6E',
        text_preview: 'A Prescriptive Machine Learning Approach...',
      }),
      key_findings: ['raw payload'],
      anchors_count: 1,
      sufficiency_score: 0.82,
      stage: 'full-review',
    })

    const result = await scanBibliographyArtifacts(store)

    expect(result.findings.some((f) => f.code === 'SCREENING_PLACEHOLDER_ARTIFACT')).toBe(true)
    expect(result.findings.some((f) => f.code === 'READING_CARD_TEMPLATE_PLACEHOLDER')).toBe(true)
    expect(result.findings.some((f) => f.code === 'READING_CARD_SERIALIZED_SOURCE_PAYLOAD')).toBe(true)
  })
})
