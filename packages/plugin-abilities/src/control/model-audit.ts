import type { ControlEvent, ModelAuditResult, ModelDriftRecord } from './types.js'

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function toDriftRecord(event: ControlEvent): ModelDriftRecord {
  const expectedModel = toStringOrUndefined(event.payload.expectedModel)
  const expectedProvider = toStringOrUndefined(event.payload.expectedProvider)
  const actualModel = toStringOrUndefined(event.payload.actualModel)
  const actualProvider = toStringOrUndefined(event.payload.actualProvider)
  const agent = toStringOrUndefined(event.payload.agent)
  const reasons: string[] = []

  if (expectedModel && actualModel && expectedModel !== actualModel) {
    reasons.push(`Expected model '${expectedModel}' but observed '${actualModel}'`)
  }

  if (expectedProvider && actualProvider && expectedProvider !== actualProvider) {
    reasons.push(`Expected provider '${expectedProvider}' but observed '${actualProvider}'`)
  }

  return {
    eventId: event.id,
    stepId: event.context.stepId,
    agent,
    expectedModel,
    expectedProvider,
    actualModel,
    actualProvider,
    drifted: reasons.length > 0,
    reasons,
  }
}

export function evaluateModelDrift(events: readonly ControlEvent[]): ModelAuditResult {
  const records = events
    .filter((event) => event.eventType === 'model.audit')
    .map(toDriftRecord)

  return {
    runId: events[0]?.runId ?? 'unknown-run',
    observed: records.length,
    driftCount: records.filter((record) => record.drifted).length,
    drifts: records,
  }
}
