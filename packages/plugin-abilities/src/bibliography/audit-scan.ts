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
    const paperKey = typeof data.paper_key === 'string' ? data.paper_key.trim() : ''
    const title = typeof data.title === 'string' ? data.title.trim() : ''
    const searchSummary = toRecord(data.search_summary)
    const warnings = Array.isArray(data.warnings)
      ? data.warnings.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value))
      : []
    const screeningItems = Array.isArray(data.items)
      ? data.items.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value))
      : []
    const screeningStatus = typeof data.screening_status === 'string' ? data.screening_status : ''

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

    if (searchSummary.plan_applied === true && screeningItems.length === 0) {
      findings.push({
        severity: 'warning',
        code: 'PLAN_DRIVEN_SCREENING_EMPTY',
        message: 'Plan-driven screening artifact contains no usable papers.',
        artifactType: 'screening',
        artifactKey: screening.meta.key,
        evidence: {
          academic_queries_used: searchSummary.academic_queries_used,
          required_terms: searchSummary.required_terms,
          support_terms: searchSummary.support_terms,
          screening_status: screeningStatus,
        },
      })
    }

    const providerWarning = typeof searchSummary.academic_warning === 'string' && searchSummary.academic_warning.trim().length > 0
      || typeof searchSummary.zotero_warning === 'string' && searchSummary.zotero_warning.trim().length > 0
      || warnings.length > 0
      || screeningStatus === 'degraded'
    if (providerWarning) {
      findings.push({
        severity: 'warning',
        code: 'SCREENING_SEARCH_WARNINGS_PRESENT',
        message: 'Screening artifact records provider warnings or degraded search coverage.',
        artifactType: 'screening',
        artifactKey: screening.meta.key,
        evidence: {
          screening_status: screeningStatus,
          academic_warning: searchSummary.academic_warning,
          zotero_warning: searchSummary.zotero_warning,
          warnings,
        },
      })
    }

    if (/^paper_\d+$/i.test(paperKey)) {
      findings.push({
        severity: 'warning',
        code: 'SCREENING_PLACEHOLDER_ARTIFACT',
        message: 'Screening artifact uses a generic placeholder paper key.',
        artifactType: 'screening',
        artifactKey: screening.meta.key,
        evidence: {
          paper_key: paperKey,
          title,
        },
      })
    }
  }

  const readingCards = await store.listAll<ReadingCardData>('reading-card')
  for (const card of readingCards) {
    const data = toRecord(card.data)
    const summary = typeof data.summary === 'string' ? data.summary.trim() : ''
    const keyFindings = Array.isArray(data.key_findings)
      ? data.key_findings.filter((value): value is string => typeof value === 'string')
      : []

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

    if (summary === 'Full-text reviewed with traceable anchors.' || keyFindings.some((finding) => /^Finding [A-Z]\b/.test(finding))) {
      findings.push({
        severity: 'warning',
        code: 'READING_CARD_TEMPLATE_PLACEHOLDER',
        message: 'Reading card still contains template placeholder content.',
        artifactType: 'reading-card',
        artifactKey: card.meta.key,
        evidence: {
          summary,
          key_findings: keyFindings,
        },
      })
    }

    const serializedSummary = parseSerializedObject(summary)
    const looksSerializedPayload = Boolean(
      (serializedSummary && typeof serializedSummary.item_key === 'string')
      || (summary.startsWith('{"item_key"') && summary.includes('"attachment_key"'))
    )
    if (looksSerializedPayload) {
      findings.push({
        severity: 'warning',
        code: 'READING_CARD_SERIALIZED_SOURCE_PAYLOAD',
        message: 'Reading card summary contains serialized source metadata instead of extracted text.',
        artifactType: 'reading-card',
        artifactKey: card.meta.key,
        evidence: {
          summary_preview: summary.slice(0, 200),
          parsed_keys: serializedSummary ? Object.keys(serializedSummary).slice(0, 8) : [],
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

function parseSerializedObject(value: string): Record<string, unknown> | null {
  if (!value.startsWith('{') || !value.endsWith('}')) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}
