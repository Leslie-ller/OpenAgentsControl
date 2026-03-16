/**
 * Model Drift Audit (v1.8)
 *
 * Consumes `model.observed` events from the unified event stream
 * to detect mismatches between expected and actual model/provider.
 *
 * Design principle: audit-only in v1.
 * - Records whether drift occurred
 * - Does NOT change gate verdict
 * - Does NOT cause execution failure
 *
 * Future: drift_policy modes (audit-only | soft-pin | hard-pin)
 * will allow escalation to warn or block verdicts.
 *
 * Reference: "OpenAgentsControl 模型漂移审计（v1.8）" design doc
 */

import type { ControlEvent, ModelObservedPayload } from './events.js'
import type { ModelAuditResult, ModelDriftEntry } from '../types/index.js'

/**
 * Evaluate model drift from the unified event stream.
 *
 * Scans all `model.observed` events in the stream and produces
 * a summary of observations and drift occurrences.
 *
 * @param events - The control event stream for a single run
 * @returns ModelAuditResult with observation count, drift count, and individual drifts.
 *          Returns undefined if no model.observed events exist (no model observations made).
 */
export function evaluateModelDrift(
  events: readonly ControlEvent[]
): ModelAuditResult | undefined {
  const modelEvents = events.filter(
    (e) => e.event_type === 'model.observed'
  )

  if (modelEvents.length === 0) {
    return undefined
  }

  const drifts: ModelDriftEntry[] = []

  for (const event of modelEvents) {
    const payload = event.payload as ModelObservedPayload

    if (payload.drift) {
      drifts.push({
        stepId: event.context.step_id ?? event.id,
        expectedModel: payload.expected_model,
        actualModel: payload.actual_model,
        expectedProvider: payload.expected_provider,
        actualProvider: payload.actual_provider,
        source: payload.source,
      })
    }
  }

  return {
    observed: modelEvents.length,
    driftCount: drifts.length,
    drifts,
  }
}

/**
 * Determine if a model/provider pair has drifted from expectations.
 *
 * Utility function for use at the emission site (e.g., executor agent step).
 * Returns true if either model or provider does not match.
 * Fields that are undefined on either side are not considered drift.
 */
export function hasModelDrift(
  expected: { model?: string; provider?: string },
  actual: { model?: string; provider?: string }
): boolean {
  const modelDrift =
    expected.model !== undefined &&
    actual.model !== undefined &&
    expected.model !== actual.model

  const providerDrift =
    expected.provider !== undefined &&
    actual.provider !== undefined &&
    expected.provider !== actual.provider

  return modelDrift || providerDrift
}
