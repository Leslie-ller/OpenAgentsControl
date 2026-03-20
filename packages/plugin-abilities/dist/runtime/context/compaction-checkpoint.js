import { resolveTopicFromExecution } from './topic-resolver.js';
function parseOutputs(execution) {
    return execution.completedSteps
        .map((step) => step.output)
        .filter((output) => typeof output === 'string' && output.trim().length > 0)
        .map((output) => {
        try {
            const parsed = JSON.parse(output.trim());
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch {
            // ignore non-json
        }
        return undefined;
    })
        .filter((item) => item !== undefined);
}
function asStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}
function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
function buildPlanOutline(taskPlan) {
    if (!taskPlan)
        return [];
    const lines = [];
    if (taskPlan.objective)
        lines.push(`objective: ${taskPlan.objective}`);
    for (const item of taskPlan.acceptance_criteria) {
        lines.push(`acceptance: ${item}`);
    }
    for (const item of taskPlan.deliverables) {
        lines.push(`deliverable: ${item}`);
    }
    for (const item of taskPlan.context_files) {
        lines.push(`context_file: ${item}`);
    }
    for (const item of taskPlan.reference_files) {
        lines.push(`reference_file: ${item}`);
    }
    return lines;
}
function buildStateCapsule(execution, topic) {
    const now = new Date().toISOString();
    const constraints = [];
    if (execution.control?.gate.verdict === 'block')
        constraints.push('Completion currently blocked by control gate');
    if (execution.control?.gate.verdict === 'warn')
        constraints.push('Completion has warnings that must be surfaced');
    return {
        topic,
        current_state: `${execution.ability.name} is ${execution.status}`,
        based_on: [execution.ability.name],
        next_action: execution.status === 'failed'
            ? 'Resolve blocking errors and rerun validation.'
            : 'Continue with the next planned workflow stage.',
        open_questions: execution.error ? [execution.error] : [],
        key_constraints: constraints,
        updated_at: now,
    };
}
function buildDetailCapsule(execution, topic, taskPlan) {
    const now = new Date().toISOString();
    const outputs = parseOutputs(execution);
    const commands_run = outputs.flatMap((item) => asStringArray(item.commands));
    const file_refs = outputs.flatMap((item) => asStringArray(item.changed_files));
    const unresolved_edges = [
        ...outputs.flatMap((item) => asStringArray(item.dependency_violations)),
        ...(execution.control?.gate.reasons ?? []),
    ];
    return {
        topic,
        plan_outline: buildPlanOutline(taskPlan),
        critical_details: outputs
            .map((item) => asString(item.implementation_summary))
            .filter((item) => item.length > 0),
        decisions: outputs
            .map((item) => asString(item.verdict))
            .filter((item) => item.length > 0)
            .map((verdict) => `review_verdict:${verdict}`),
        evidence: outputs.flatMap((item) => asStringArray(item.validated_claims)),
        file_refs,
        commands_run,
        unresolved_edges,
        updated_at: now,
    };
}
function renderCheckpointSummary(state, detail) {
    const detailProjection = detail.plan_outline.slice(0, 3)
        .concat(detail.critical_details.slice(0, 3))
        .concat(detail.unresolved_edges.slice(0, 3));
    const lines = [
        'Checkpoint Context:',
        `topic: ${state.topic}`,
        `current_state: ${state.current_state}`,
        `next_action: ${state.next_action}`,
        'open_questions:',
        ...(state.open_questions.length > 0 ? state.open_questions.map((item) => `  - ${item}`) : ['  - none']),
        '',
        'Critical Details To Preserve:',
        ...(detailProjection.length > 0 ? detailProjection.map((item) => `- ${item}`) : ['- none']),
    ];
    return lines.join('\n');
}
export async function createCompactionCheckpoint(execution, store, options) {
    const topic = resolveTopicFromExecution(execution);
    const state = buildStateCapsule(execution, topic);
    const detail = buildDetailCapsule(execution, topic, options?.taskPlan);
    await store.saveState(state);
    await store.saveDetail(detail);
    return {
        topic,
        state,
        detail,
        summary: renderCheckpointSummary(state, detail),
    };
}
//# sourceMappingURL=compaction-checkpoint.js.map
