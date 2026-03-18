/**
 * Obligation Registry — resolution layer for obligation definitions.
 *
 * Priority order:
 *   1. Inline obligations from the Ability definition (ability.obligations)
 *   2. Built-in defaults keyed by task_type
 *   3. Empty array (no obligations — gate defaults to 'allow')
 *
 * The registry also supports runtime registration of additional
 * task-type obligation templates (e.g., from external config files).
 *
 * Design principle: backward compatible.
 * - Existing abilities with task_type and no inline obligations
 *   continue to resolve via built-in defaults.
 * - New abilities can define custom task types + inline obligations
 *   without touching this file.
 */

import type { Ability, ObligationDefinition, TaskType } from '../types/index.js'

// ─────────────────────────────────────────────────────────────
// BUILT-IN DEFAULTS
// ─────────────────────────────────────────────────────────────

/**
 * The same obligation definitions that were previously hardcoded
 * in control/index.ts as `TASK_OBLIGATIONS`.
 * Kept here as the built-in fallback layer.
 */
const BUILTIN_OBLIGATIONS: Record<string, ObligationDefinition[]> = {
  code_change: [
    { key: 'run_tests', severity: 'hard', tags: ['test'] },
    { key: 'record_validation', severity: 'hard', tags: ['validation'] },
    { key: 'commit_if_required', severity: 'soft', tags: ['commit'] },
  ],
  paper_screening: [
    { key: 'record_screening_decision', severity: 'hard', tags: ['screening-decision'] },
  ],
  paper_fulltext_review: [
    { key: 'extract_fulltext', severity: 'hard', tags: ['fulltext-extract'] },
    { key: 'record_reading_card', severity: 'hard', tags: ['reading-card'] },
  ],
  literature_decision: [
    { key: 'record_decision_card', severity: 'hard', tags: ['decision-card'] },
  ],
  section_evidence_pack: [
    { key: 'record_evidence_pack', severity: 'hard', tags: ['evidence-pack'] },
  ],
  citation_audit: [
    { key: 'record_citation_audit', severity: 'hard', tags: ['citation-audit'] },
  ],
  research_evidence_control: [
    {
      key: 'task_level_sufficiency_check',
      severity: 'hard',
      tags: ['task-sufficiency-check'],
      signals: ['task_level_sufficiency_check'],
      requiredFields: ['sufficiency_score'],
      description: 'Output includes task-level sufficiency evidence.',
    },
    {
      key: 'evidence_grounding',
      severity: 'hard',
      tags: ['evidence-grounding'],
      signals: ['evidence_grounding'],
      requiredFields: ['anchors_count'],
      description: 'Output includes grounding anchors metadata.',
    },
    {
      key: 'uncertainty_annotation',
      severity: 'hard',
      tags: ['uncertainty-annotation'],
      signals: ['uncertainty_annotation'],
      requiredFields: ['uncertainty_level'],
      description: 'Output includes uncertainty annotation.',
    },
    {
      key: 'artifact_lineage_recorded',
      severity: 'hard',
      tags: ['artifact-lineage'],
      signals: ['artifact_lineage_recorded'],
      requiredFields: ['source_stage'],
      description: 'Output includes artifact lineage metadata.',
    },
    {
      key: 'decision_rationale_recorded',
      severity: 'hard',
      tags: ['decision-rationale'],
      signals: ['decision_rationale_recorded'],
      requiredFields: ['rationale'],
      description: 'Decision output includes rationale.',
    },
  ],
}

// ─────────────────────────────────────────────────────────────
// REGISTRY CLASS
// ─────────────────────────────────────────────────────────────

export class ObligationRegistry {
  /** Runtime-registered obligation templates (higher priority than built-in) */
  private registered: Map<string, ObligationDefinition[]> = new Map()

  /**
   * Register obligation definitions for a task type at runtime.
   * These take priority over built-in defaults but are overridden
   * by inline obligations defined on individual abilities.
   */
  register(taskType: string, obligations: ObligationDefinition[]): void {
    this.registered.set(taskType, obligations)
  }

  /**
   * Remove a runtime-registered task type.
   * The built-in default (if any) will be used again.
   */
  unregister(taskType: string): void {
    this.registered.delete(taskType)
  }

  /**
   * Resolve obligation definitions for a given ability.
   *
   * Resolution order:
   *   1. ability.obligations (inline) — if present, always wins
   *   2. runtime-registered obligations for ability.task_type
   *   3. built-in defaults for ability.task_type
   *   4. empty array (no obligations)
   */
  resolve(ability: Ability): ObligationDefinition[] {
    // Priority 1: inline obligations
    if (ability.obligations && ability.obligations.length > 0) {
      return ability.obligations
    }

    const taskType = ability.task_type
    if (!taskType) {
      return []
    }

    // Priority 2: runtime-registered
    const runtime = this.registered.get(taskType)
    if (runtime) {
      return runtime
    }

    // Priority 3: built-in defaults
    return BUILTIN_OBLIGATIONS[taskType] ?? []
  }

  /**
   * Get all known task types (built-in + runtime-registered).
   * Useful for tooling / documentation.
   */
  getKnownTaskTypes(): string[] {
    const types = new Set<string>([
      ...Object.keys(BUILTIN_OBLIGATIONS),
      ...this.registered.keys(),
    ])
    return [...types].sort()
  }

  /**
   * Check if a task type has any obligation definitions
   * (built-in or runtime-registered).
   */
  hasTaskType(taskType: string): boolean {
    return this.registered.has(taskType) || taskType in BUILTIN_OBLIGATIONS
  }

  /** Reset runtime registrations (for testing). */
  reset(): void {
    this.registered.clear()
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON + FUNCTIONAL API
// ─────────────────────────────────────────────────────────────

/** Default global registry instance. */
export const defaultRegistry = new ObligationRegistry()

/**
 * Resolve obligations for an ability using the default registry.
 * Convenience function for use in evaluateControl / evaluateControlFromEvents.
 */
export function resolveObligations(ability: Ability): ObligationDefinition[] {
  return defaultRegistry.resolve(ability)
}

/**
 * Get the built-in obligation definitions for a task type.
 * Useful for introspection / testing.
 */
export function getBuiltinObligations(taskType: string): ObligationDefinition[] {
  return BUILTIN_OBLIGATIONS[taskType] ?? []
}
