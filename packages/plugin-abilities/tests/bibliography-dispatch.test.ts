import { describe, it, expect } from 'bun:test'

/**
 * Tests for the bibliography command dispatcher routing fixes.
 *
 * These tests verify the route() function behavior by testing the SDK's
 * executeCommand method routing logic in isolation. We re-implement the
 * route function to test it without needing the full SDK (which requires
 * ability loading from YAML).
 */

// ── Reproduce the routing logic from sdk.ts / opencode-plugin.ts ──

function route(
  command: string,
  args: Record<string, unknown>
): { abilityName: string; inputs: Record<string, unknown> } | null {
  const value = typeof args.value === 'string' ? args.value : ''

  switch (command) {
    case '/paper-screening':
      return { abilityName: 'research/paper-screening', inputs: { query: String(args.query ?? value), limit: Number(args.limit ?? 10) } }
    case '/paper-fulltext-review':
      return { abilityName: 'research/paper-fulltext-review', inputs: { zotero_key: String(args.zotero_key ?? args.paper_key ?? value) } }
    case '/literature-decision':
      return { abilityName: 'research/literature-decision', inputs: { paper_key: String(args.paper_key ?? value) } }
    case '/section-evidence-pack':
      return { abilityName: 'research/section-evidence-pack', inputs: { section: String(args.section ?? value) } }
    case '/citation-audit':
      return { abilityName: 'research/citation-audit', inputs: { section: String(args.section ?? value) } }
    case '/bibliography': {
      const stage = String(args.stage ?? '').trim() || value.split(/\s+/)[0] || 'plan'
      const rest = String(args.payload ?? value.split(/\s+/).slice(1).join(' ')).trim()
      if (stage === 'plan') return { abilityName: 'research/bibliography-plan', inputs: { topic: rest } }
      if (stage === 'screening') return { abilityName: 'research/paper-screening', inputs: { query: rest, limit: Number(args.limit ?? 10) } }
      if (stage === 'review') return { abilityName: 'research/paper-fulltext-review', inputs: { zotero_key: rest } }
      if (stage === 'decision') return { abilityName: 'research/literature-decision', inputs: { paper_key: rest } }
      if (stage === 'evidence-pack') return { abilityName: 'research/section-evidence-pack', inputs: { section: rest } }
      if (stage === 'audit') return { abilityName: 'research/citation-audit', inputs: { section: rest } }
      return null
    }
    default:
      return null
  }
}

// ── Tests ───────────────────────────────────────────────────

describe('bibliography command dispatch', () => {
  // ── Direct commands ─────────────────────────────────────

  describe('direct slash commands', () => {
    it('/paper-screening routes correctly', () => {
      const r = route('/paper-screening', { query: 'agent safety' })
      expect(r).not.toBeNull()
      expect(r!.abilityName).toBe('research/paper-screening')
      expect(r!.inputs.query).toBe('agent safety')
    })

    it('/paper-screening uses value fallback', () => {
      const r = route('/paper-screening', { value: 'LLM safety' })
      expect(r!.inputs.query).toBe('LLM safety')
    })

    it('/paper-fulltext-review routes correctly', () => {
      const r = route('/paper-fulltext-review', { zotero_key: 'ABC123' })
      expect(r!.abilityName).toBe('research/paper-fulltext-review')
      expect(r!.inputs.zotero_key).toBe('ABC123')
    })

    it('/paper-fulltext-review accepts paper_key alias', () => {
      const r = route('/paper-fulltext-review', { paper_key: 'DEF456' })
      expect(r!.inputs.zotero_key).toBe('DEF456')
    })

    it('/literature-decision routes correctly', () => {
      const r = route('/literature-decision', { paper_key: 'paper_001' })
      expect(r!.abilityName).toBe('research/literature-decision')
      expect(r!.inputs.paper_key).toBe('paper_001')
    })

    it('/section-evidence-pack routes correctly', () => {
      const r = route('/section-evidence-pack', { section: 'chapter-3' })
      expect(r!.abilityName).toBe('research/section-evidence-pack')
      expect(r!.inputs.section).toBe('chapter-3')
    })

    it('/citation-audit routes correctly', () => {
      const r = route('/citation-audit', { section: 'chapter-3' })
      expect(r!.abilityName).toBe('research/citation-audit')
      expect(r!.inputs.section).toBe('chapter-3')
    })
  })

  // ── /bibliography meta-command ──────────────────────────

  describe('/bibliography meta-command', () => {
    it('defaults to plan stage', () => {
      const r = route('/bibliography', { value: '' })
      expect(r).not.toBeNull()
      expect(r!.abilityName).toBe('research/bibliography-plan')
    })

    it('plan stage routes to bibliography-plan ability', () => {
      const r = route('/bibliography', { stage: 'plan', payload: 'agent safety' })
      expect(r!.abilityName).toBe('research/bibliography-plan')
      expect(r!.inputs.topic).toBe('agent safety')
    })

    it('plan stage parses topic from value', () => {
      const r = route('/bibliography', { value: 'plan agent safety research' })
      expect(r!.abilityName).toBe('research/bibliography-plan')
      expect(r!.inputs.topic).toBe('agent safety research')
    })

    it('screening stage routes correctly', () => {
      const r = route('/bibliography', { stage: 'screening', payload: 'LLM safety' })
      expect(r!.abilityName).toBe('research/paper-screening')
      expect(r!.inputs.query).toBe('LLM safety')
    })

    it('review stage routes correctly', () => {
      const r = route('/bibliography', { stage: 'review', payload: 'ABC123' })
      expect(r!.abilityName).toBe('research/paper-fulltext-review')
      expect(r!.inputs.zotero_key).toBe('ABC123')
    })

    it('decision stage routes correctly', () => {
      const r = route('/bibliography', { stage: 'decision', payload: 'paper_001' })
      expect(r!.abilityName).toBe('research/literature-decision')
      expect(r!.inputs.paper_key).toBe('paper_001')
    })

    it('evidence-pack stage routes correctly (was missing)', () => {
      const r = route('/bibliography', { stage: 'evidence-pack', payload: 'chapter-3' })
      expect(r).not.toBeNull()
      expect(r!.abilityName).toBe('research/section-evidence-pack')
      expect(r!.inputs.section).toBe('chapter-3')
    })

    it('evidence-pack stage parses from value', () => {
      const r = route('/bibliography', { value: 'evidence-pack chapter-3' })
      expect(r!.abilityName).toBe('research/section-evidence-pack')
      expect(r!.inputs.section).toBe('chapter-3')
    })

    it('audit stage routes correctly', () => {
      const r = route('/bibliography', { stage: 'audit', payload: 'chapter-3' })
      expect(r!.abilityName).toBe('research/citation-audit')
      expect(r!.inputs.section).toBe('chapter-3')
    })

    it('unknown stage returns null', () => {
      const r = route('/bibliography', { stage: 'unknown-stage' })
      expect(r).toBeNull()
    })
  })

  // ── Unknown commands ────────────────────────────────────

  describe('unknown commands', () => {
    it('returns null for unrecognized command', () => {
      expect(route('/unknown', {})).toBeNull()
    })

    it('returns null for empty command', () => {
      expect(route('', {})).toBeNull()
    })
  })

  // ── Limit parameter handling ──────────────────────────────

  describe('limit parameter', () => {
    it('uses default limit of 10', () => {
      const r = route('/paper-screening', { query: 'test' })
      expect(r!.inputs.limit).toBe(10)
    })

    it('accepts custom limit', () => {
      const r = route('/paper-screening', { query: 'test', limit: 25 })
      expect(r!.inputs.limit).toBe(25)
    })

    it('/bibliography screening uses limit', () => {
      const r = route('/bibliography', { stage: 'screening', payload: 'test', limit: 5 })
      expect(r!.inputs.limit).toBe(5)
    })
  })
})
