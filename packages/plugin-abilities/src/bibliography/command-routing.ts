import type { InputValues } from '../types/index.js'

export interface BibliographyCommandRoute {
  stage: string
  abilityName: string
  inputs: InputValues
}

export function parseCommandInput(raw?: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }
  return { value: raw.trim() }
}

export function routeBibliographyCommand(
  commandName: string,
  args: Record<string, unknown>
): BibliographyCommandRoute | null {
  const value = typeof args.value === 'string' ? args.value : ''

  switch (commandName) {
    case '/paper-screening':
      return {
        stage: 'screening',
        abilityName: 'research/paper-screening',
        inputs: {
          query: String(args.query ?? value),
          limit: Number(args.limit ?? 10),
        },
      }
    case '/paper-fulltext-review':
      return {
        stage: 'review',
        abilityName: 'research/paper-fulltext-review',
        inputs: {
          zotero_key: String(args.zotero_key ?? args.paper_key ?? value),
        },
      }
    case '/literature-decision':
      return {
        stage: 'decision',
        abilityName: 'research/literature-decision',
        inputs: {
          paper_key: String(args.paper_key ?? value),
        },
      }
    case '/section-evidence-pack':
      return {
        stage: 'evidence-pack',
        abilityName: 'research/section-evidence-pack',
        inputs: {
          section: String(args.section ?? value),
        },
      }
    case '/citation-audit':
      return {
        stage: 'audit',
        abilityName: 'research/citation-audit',
        inputs: {
          section: String(args.section ?? value),
        },
      }
    case '/bibliography': {
      const stage = String(args.stage ?? '').trim() || value.split(/\s+/)[0] || 'plan'
      const rest = String(args.payload ?? value.split(/\s+/).slice(1).join(' ')).trim()
      if (stage === 'plan') {
        return {
          stage: 'plan',
          abilityName: 'research/bibliography-plan',
          inputs: { topic: rest },
        }
      }
      if (stage === 'screening') {
        return {
          stage: 'screening',
          abilityName: 'research/paper-screening',
          inputs: { query: rest, limit: Number(args.limit ?? 10) },
        }
      }
      if (stage === 'review') {
        return {
          stage: 'review',
          abilityName: 'research/paper-fulltext-review',
          inputs: { zotero_key: rest },
        }
      }
      if (stage === 'decision') {
        return {
          stage: 'decision',
          abilityName: 'research/literature-decision',
          inputs: { paper_key: rest },
        }
      }
      if (stage === 'evidence-pack') {
        return {
          stage: 'evidence-pack',
          abilityName: 'research/section-evidence-pack',
          inputs: { section: rest },
        }
      }
      if (stage === 'audit') {
        return {
          stage: 'audit',
          abilityName: 'research/citation-audit',
          inputs: { section: rest },
        }
      }
      return null
    }
    default:
      return null
  }
}
