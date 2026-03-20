import { describe, it, expect } from 'bun:test'
import { routeBibliographyCommand } from '../src/bibliography/command-routing.js'

/**
 * Tests for the bibliography command dispatcher routing fixes.
 *
 * These tests verify the route() function behavior by testing the SDK's
 * executeCommand method routing logic in isolation. We re-implement the
 * route function to test it without needing the full SDK (which requires
 * ability loading from YAML).
 */

const route = routeBibliographyCommand

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

    it('/paper-screening forwards collection key when provided', () => {
      const r = route('/paper-screening', { query: 'agent safety', collection_key: 'NNV7TZ9J' })
      expect(r!.inputs.collection_key).toBe('NNV7TZ9J')
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

    it('/paper-fulltext-review forwards collection key when provided', () => {
      const r = route('/paper-fulltext-review', { zotero_key: 'ABC123', collection_key: 'NNV7TZ9J' })
      expect(r!.inputs.collection_key).toBe('NNV7TZ9J')
    })

    it('/literature-decision routes correctly', () => {
      const r = route('/literature-decision', { paper_key: 'paper_001' })
      expect(r!.abilityName).toBe('research/literature-decision')
      expect(r!.inputs.paper_key).toBe('paper_001')
    })

    it('/literature-decision forwards reading-card execution id when provided', () => {
      const r = route('/literature-decision', {
        paper_key: 'paper_001',
        reading_card_execution_id: 'exec_123',
      })
      expect(r!.inputs.reading_card_execution_id).toBe('exec_123')
    })

    it('/section-evidence-pack routes correctly', () => {
      const r = route('/section-evidence-pack', { section: 'chapter-3' })
      expect(r!.abilityName).toBe('research/section-evidence-pack')
      expect(r!.inputs.section).toBe('chapter-3')
    })

    it('/section-evidence-pack forwards scoped paper keys', () => {
      const r = route('/section-evidence-pack', { section: 'chapter-3', paper_keys: ['P1', 'P2'] })
      expect(r!.inputs.paper_keys).toEqual(['P1', 'P2'])
    })

    it('/citation-audit routes correctly', () => {
      const r = route('/citation-audit', { section: 'chapter-3' })
      expect(r!.abilityName).toBe('research/citation-audit')
      expect(r!.inputs.section).toBe('chapter-3')
    })

    it('/citation-audit forwards comma-delimited paper keys', () => {
      const r = route('/citation-audit', { section: 'chapter-3', paper_keys: 'P1,P2' })
      expect(r!.inputs.paper_keys).toEqual(['P1', 'P2'])
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

    it('screening stage forwards collection key', () => {
      const r = route('/bibliography', { stage: 'screening', payload: 'LLM safety', collection_key: 'NNV7TZ9J' })
      expect(r!.inputs.collection_key).toBe('NNV7TZ9J')
    })

    it('review stage routes correctly', () => {
      const r = route('/bibliography', { stage: 'review', payload: 'ABC123' })
      expect(r!.abilityName).toBe('research/paper-fulltext-review')
      expect(r!.inputs.zotero_key).toBe('ABC123')
    })

    it('review stage forwards collection key', () => {
      const r = route('/bibliography', { stage: 'review', payload: 'ABC123', collection_key: 'NNV7TZ9J' })
      expect(r!.inputs.collection_key).toBe('NNV7TZ9J')
    })

    it('decision stage routes correctly', () => {
      const r = route('/bibliography', { stage: 'decision', payload: 'paper_001' })
      expect(r!.abilityName).toBe('research/literature-decision')
      expect(r!.inputs.paper_key).toBe('paper_001')
    })

    it('decision stage forwards reading-card execution id', () => {
      const r = route('/bibliography', {
        stage: 'decision',
        payload: 'paper_001',
        reading_card_execution_id: 'exec_456',
      })
      expect(r!.inputs.reading_card_execution_id).toBe('exec_456')
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

    it('evidence-pack stage forwards scoped paper keys', () => {
      const r = route('/bibliography', { stage: 'evidence-pack', payload: 'chapter-3', paper_keys: ['P1'] })
      expect(r!.inputs.paper_keys).toEqual(['P1'])
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
