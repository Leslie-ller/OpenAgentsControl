import type { ArtifactType } from './store.js'
import type { BibliographyStore, ScreeningData, ReadingCardData } from './store.js'

export type AuditFindingSeverity = 'error' | 'warning' | 'info'

export interface AuditFinding {
  severity: AuditFindingSeverity
  code: string
  message: string
  artifactType: ArtifactType
  artifactKey: string
  evidence: Record<string, unknown>
}

export interface AuditScanResult {
  scannedAt: string
  totals: {
    findings: number
    errors: number
    warnings: number
    infos: number
  }
  findings: AuditFinding[]
}

export async function scanBibliographyArtifacts(store: BibliographyStore): Promise<AuditScanResult> {
  const findings: AuditFinding[] = []

  const screenings = await store.listAll<ScreeningData>('screening')
  for (const screening of screenings) {
    const data = toRecord(screening.data)

    const hasRole = typeof data.role === 'string' && data.role.trim().length > 0
    const hasUsage = typeof data.recommended_usage === 'string' && data.recommended_usage.trim().length > 0
    if (hasRole && !hasUsage) {
      findings.push({
        severity: 'warning',
        code: 'SCREENING_ROLE_USAGE_INCONSISTENT',
        message: 'Screening role exists without recommended_usage.',
        artifactType: 'screening',
        artifactKey: screening.meta.key,
        evidence: {
          role: data.role,
          recommended_usage: data.recommended_usage,
        },
      })
    }
  }

  const readingCards = await store.listAll<ReadingCardData>('reading-card')
  for (const card of readingCards) {
    const data = toRecord(card.data)

    const impact = typeof data.claim_impact === 'string' ? data.claim_impact : ''
    const anchors = typeof data.anchors_count === 'number' ? data.anchors_count : undefined
    if (impact === 'high' && (anchors === undefined || anchors <= 0)) {
      findings.push({
        severity: 'error',
        code: 'HIGH_IMPACT_WITHOUT_ANCHORS',
        message: 'High-impact claim review lacks evidence anchors.',
        artifactType: 'reading-card',
        artifactKey: card.meta.key,
        evidence: {
          claim_impact: impact,
          anchors_count: anchors,
        },
      })
    }

    const sufficiency = typeof data.sufficiency_score === 'number' ? data.sufficiency_score : undefined
    const stage = typeof data.stage === 'string' ? data.stage : undefined
    if (stage === 'full-review' && sufficiency !== undefined && sufficiency < 0.6) {
      findings.push({
        severity: 'warning',
        code: 'LOW_SUFFICIENCY_MARKED_FULL_REVIEW',
        message: 'Artifact marked full-review with low sufficiency score.',
        artifactType: 'reading-card',
        artifactKey: card.meta.key,
        evidence: {
          stage,
          sufficiency_score: sufficiency,
        },
      })
    }
  }

  const decisions = await store.listAll('decision')
  for (const decision of decisions) {
    const data = toRecord(decision.data)
    const hasAuthorWarning = typeof data.author_metadata_warning === 'string' && data.author_metadata_warning.length > 0
    const usedForCitation = Boolean(data.used_for_citation)
    if (usedForCitation && !hasAuthorWarning) {
      findings.push({
        severity: 'info',
        code: 'CITATION_WITHOUT_AUTHOR_WARNING',
        message: 'Citation decision has no author metadata warning field.',
        artifactType: 'decision',
        artifactKey: decision.meta.key,
        evidence: {
          used_for_citation: usedForCitation,
          author_metadata_warning: data.author_metadata_warning,
        },
      })
    }
  }

  const totals = {
    findings: findings.length,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    infos: findings.filter((f) => f.severity === 'info').length,
  }

  return {
    scannedAt: new Date().toISOString(),
    totals,
    findings,
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
