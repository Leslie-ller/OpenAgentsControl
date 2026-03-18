# Bibliography Control Remediation Plan

Status: draft
Owner: repository-manager
Last Updated: 2026-03-18

## Goal

Close the gap between bibliography workflow structure and bibliography content trustworthiness.

This plan is designed to be directly executable by an implementation agent. It defines:
- which controls belong in the shared control layer
- which checks belong in bibliography-specific workflow configuration
- which files should change
- in what order the work should be delivered
- what counts as done for each phase

## Problem Statement

The current fork added useful control and bibliography infrastructure, but the runtime still allows structurally complete outputs that are not evidence-grounded.

Observed failure modes:
- full-text review can proceed without verifying that extracted content is sufficient for full-text claims
- control obligations check step completion, not evidence quality
- role/usage decisions can contradict limitations without being blocked
- runtime command routing does not use the new `BibliographyPipeline`
- screening persistence is not modeled per paper, which weakens queueing and auditability

## Design Boundary

This plan separates fixes into two layers.

### Shared Control Layer

These controls must be reusable outside bibliography workflows:
- evidence grounding
- task-level sufficiency
- uncertainty downgrade
- capability gating
- consistency gating
- artifact lineage
- claim scope control

### Bibliography-Specific Layer

These remain workflow-specific heuristics:
- markdown extraction looks abstract-only
- author metadata may be unreliable
- academic-paper evidence anchors prefer page/table/formula/section references
- bibliography role taxonomy such as `core support`, `method support`, `related work`

## Non-Goals

- Do not hardcode MinerU-specific thresholds as framework-wide rules.
- Do not hardcode bibliography role labels into the generic control core.
- Do not solve content quality only with post-hoc human audit.
- Do not ship a fake end-to-end pipeline where placeholder stages can pass as valid research work.

## Workstreams

### WS1: Wire Runtime Commands to the Bibliography Pipeline

Objective:
- make `/bibliography` and related slash commands execute through `BibliographyPipeline` rather than bypassing it

Why first:
- without runtime wiring, later control improvements remain library-only

Target files:
- `packages/plugin-abilities/src/opencode-plugin.ts`
- `packages/plugin-abilities/src/sdk.ts`
- `packages/plugin-abilities/src/bibliography/pipeline.ts`
- `packages/plugin-abilities/src/bibliography/store.ts`
- `packages/plugin-abilities/tests/bibliography-dispatch.test.ts`
- add new integration tests under `packages/plugin-abilities/tests/`

Implementation tasks:
1. Instantiate `BibliographyStore` and `BibliographyPipeline` in plugin startup.
2. Route bibliography stage commands through `pipeline.runStage(...)`.
3. Ensure direct commands and `/bibliography` meta-command share the same stage execution path.
4. Return pipeline artifact metadata in command results.
5. Add integration tests that fail if command routing bypasses pipeline persistence.

Acceptance criteria:
1. Running a bibliography stage creates an artifact in `.opencode/bibliography-data/`.
2. `execution.control`, `artifact.meta`, and `artifact.data` are all visible in command output.
3. There is at least one test covering plugin or SDK execution through the pipeline, not just duplicated route logic.

### WS2: Fix Artifact Model to Be Per-Paper Where Required

Objective:
- align runtime persistence with the real bibliography domain model

Why:
- screening produces many paper-level decisions, not one query-level terminal record

Target files:
- `packages/plugin-abilities/src/bibliography/store.ts`
- `packages/plugin-abilities/src/bibliography/pipeline.ts`
- bibliography ability YAML files under `.opencode/abilities/research/`
- `packages/plugin-abilities/tests/bibliography-store.test.ts`
- `packages/plugin-abilities/tests/bibliography-pipeline.test.ts`

Implementation tasks:
1. Redesign screening persistence so one screening run can emit multiple per-paper artifacts.
2. Define whether `plan` remains per topic and whether `screening`, `reading-card`, and `decision` must always be keyed by `paper_key`.
3. Update queue logic so `reviewQueue` and `decisionQueue` operate on canonical paper identifiers.
4. Stop relying on "last successful step output" as the sole persisted artifact model for multi-item stages.
5. Document the artifact contract in code comments and tests.

Acceptance criteria:
1. One screening run can persist N paper decisions without overwriting previous papers from the same run.
2. `getReviewQueue()` and `getDecisionQueue()` remain correct after multi-paper screening.
3. Tests explicitly cover multi-paper screening output.

### WS3: Add Generic Control Obligations and Gates

Objective:
- move from "step completed" checks to "trustworthy output" checks

Target files:
- `packages/plugin-abilities/src/control/obligation-registry.ts`
- `packages/plugin-abilities/src/control/index.ts`
- `packages/plugin-abilities/src/control/events.ts`
- `packages/plugin-abilities/src/types/index.ts`
- related control tests under `packages/plugin-abilities/tests/`

Required new obligations:
- `task_level_sufficiency_check`
- `evidence_grounding`
- `uncertainty_annotation`
- `artifact_lineage_recorded`
- `decision_rationale_recorded`

Required new gates:
- `sufficiency_gate`
- `consistency_gate`
- `capability_gate`
- `claim_scope_gate`
- `grounding_completeness_gate`

Implementation tasks:
1. Extend obligation definitions so abilities can declare structured output requirements, not only tags.
2. Add event payload support for evidence statistics and sufficiency outcomes.
3. Implement gate evaluation rules that can emit `allow`, `warn`, or `block`.
4. Keep the generic layer free of bibliography-specific field names where possible.
5. Add tests for both passing and failing cases.

Acceptance criteria:
1. A stage with missing sufficiency evidence cannot silently return `allow`.
2. A stage with missing evidence anchors can be blocked or warned according to policy.
3. Control logic can operate on structured artifact metadata rather than tags alone.

### WS4: Add Bibliography-Specific Control Profile

Objective:
- express bibliography policy in configuration or workflow definitions, not in the generic control core

Target files:
- `.opencode/abilities/research/paper-screening/ability.yaml`
- `.opencode/abilities/research/paper-fulltext-review/ability.yaml`
- `.opencode/abilities/research/literature-decision/ability.yaml`
- `.opencode/abilities/research/section-evidence-pack/ability.yaml`
- `.opencode/abilities/research/citation-audit/ability.yaml`
- optional new shared config under `.opencode/context/` or `packages/plugin-abilities/src/bibliography/`

Bibliography-specific rules to encode:
- full-text review requires a sufficiency check before reading-card completion
- high-impact claims require evidence anchors
- strong role assignments require explicit rationale
- role/recommended-usage/limitations must be self-consistent
- extraction incompleteness should trigger downgrade or re-extraction request

Implementation tasks:
1. Add inline obligations or bibliography control profile references to the relevant abilities.
2. Replace placeholder `echo` stages with structured outputs or explicit "not implemented" blocks.
3. Encode downgrade behavior when evidence is partial.
4. Ensure bibliography roles stay in workflow config, not core control enums.

Acceptance criteria:
1. A bibliography ability cannot pass by emitting placeholder text with the right tag.
2. Incomplete extraction produces a downgrade or block outcome, not a normal completed review.
3. Inconsistent role assignment is caught by bibliography-specific policy.

### WS5: Replace Placeholder Research Stages with Capability-Aware Execution

Objective:
- remove or block fake stage completion

Why:
- current placeholder stages undermine the entire trust model

Target files:
- `.opencode/abilities/research/paper-fulltext-review/ability.yaml`
- `.opencode/abilities/research/literature-decision/ability.yaml`
- `.opencode/abilities/research/section-evidence-pack/ability.yaml`
- `.opencode/abilities/research/citation-audit/ability.yaml`
- README docs that currently imply full readiness

Implementation tasks:
1. For each stage, choose one of:
   - implement real execution
   - return explicit capability error
   - mark experimental and block production use
2. Do not allow placeholder `echo` outputs to satisfy production obligations.
3. Update README wording to match reality until stages are fully implemented.

Acceptance criteria:
1. No research stage claims full support while still implemented as placeholder output.
2. Missing toolchain dependencies fail clearly and early.
3. README and runtime behavior match.

### WS6: Add Audit-Focused Batch Scans

Objective:
- reduce dependence on fully manual review for basic consistency failures

Target files:
- new scripts or commands under `packages/plugin-abilities/src/bibliography/` or `.opencode/commands/`
- test coverage for audit scan output

Recommended scans:
- screening role vs recommended usage consistency
- missing evidence anchors on strong claims
- papers marked full review with low sufficiency score
- author metadata warning presence before citation use

Implementation tasks:
1. Add a batch scan command for bibliography artifacts already stored in `.opencode/bibliography-data/`.
2. Output machine-readable findings with severity and artifact references.
3. Keep scans advisory unless explicitly turned into blocking policy.

Acceptance criteria:
1. A single command can scan stored bibliography artifacts and emit actionable findings.
2. Findings are tied to artifact keys and evidence summaries.

## Recommended Delivery Order

Phase 1:
- WS1 runtime wiring
- WS2 artifact model correction

Phase 2:
- WS3 generic obligations and gates
- WS4 bibliography-specific control profile

Phase 3:
- WS5 placeholder removal or hard blocking
- WS6 batch audit scans

Reason:
- wiring and persistence must exist before higher-order controls can be trusted

## Minimum Viable Remediation

If scope must be reduced, ship this minimum set first:
1. route runtime bibliography commands through `BibliographyPipeline`
2. make screening persistence per paper
3. add `task_level_sufficiency_check`
4. add `evidence_grounding`
5. add `consistency_gate`
6. block placeholder stages from reporting success

This is the smallest set that materially improves trustworthiness.

## Detailed Execution Checklist

### Phase 1 Checklist

- [ ] plugin creates and uses `BibliographyPipeline`
- [ ] SDK command execution uses the same pipeline path
- [ ] screening artifacts are stored per paper
- [ ] review and decision queues use canonical paper keys
- [ ] integration tests verify persistence through real command execution

### Phase 2 Checklist

- [ ] generic sufficiency obligation exists
- [ ] generic evidence-grounding obligation exists
- [ ] generic uncertainty annotation obligation exists
- [ ] consistency gate exists
- [ ] capability gate exists
- [ ] bibliography abilities declare policy using configuration, not hardcoded core logic

### Phase 3 Checklist

- [ ] placeholder stages are removed, implemented, or hard-blocked
- [ ] README no longer overstates readiness
- [ ] batch audit scan command exists
- [ ] scan output is test-covered

## Test Plan

Required test categories:
- command routing integration tests
- multi-artifact persistence tests
- control gate pass/fail tests
- bibliography policy consistency tests
- capability failure tests

Required scenarios:
1. full-text review receives abstract-only extraction and is downgraded or blocked
2. strong role assignment without evidence anchors is blocked or warned
3. placeholder stage cannot satisfy obligations
4. screening run with multiple papers persists multiple artifacts
5. missing toolchain capability stops execution rather than faking success

## Documentation Updates Required

Update these after implementation:
- `README.md`
- bibliography command docs under `.opencode/`
- any control-layer API reference that explains obligations or gates

Documentation must state:
- what is enforced generically
- what is bibliography-specific policy
- what remains advisory warning only

## Risks

- Risk: overfitting controls to the current literature-card workflow
  - Mitigation: keep generic control names independent from bibliography field names.

- Risk: too much policy ends up in code instead of workflow config
  - Mitigation: keep bibliography taxonomy and heuristics outside the core control engine.

- Risk: placeholder removal slows short-term demos
  - Mitigation: prefer explicit capability errors over fake success.

## Definition of Done

This remediation is complete when:
1. runtime bibliography commands execute through the pipeline and persist auditable artifacts
2. multi-paper screening is represented correctly
3. control verdicts depend on sufficiency and evidence, not tags alone
4. bibliography-specific consistency policy is enforced without polluting the generic framework
5. placeholder stages cannot masquerade as trustworthy research outputs
6. stored artifacts can be batch-scanned for common audit failures

## Delegation Request (TaskManager)

Break this plan into atomic engineering tasks with dependencies. Prioritize WS1 and WS2 first. Do not start bibliography-specific heuristics before generic control contracts and runtime wiring are in place.
