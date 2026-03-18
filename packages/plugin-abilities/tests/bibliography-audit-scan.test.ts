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
})
