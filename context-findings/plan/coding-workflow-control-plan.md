# Coding Workflow Control Plan

Status: draft
Owner: repository-manager
Last Updated: 2026-03-18

## Goal

Define an implementation-ready coding workflow for OpenAgentsControl that:
- reuses the repository's existing skill and subagent architecture
- adds hard execution controls where soft workflow guidance is not enough
- produces auditable artifacts for planning, implementation, validation, and review
- avoids inventing a parallel system when strong patterns already exist in the repository

This document is intended to be directly executable by an implementation agent.

## Why This Plan Exists

The repository already contains strong workflow building blocks:
- 6-stage development flow in `plugins/claude-code`
- task decomposition via `task-breakdown`
- implementation via `code-execution`
- test work via `test-generation`
- review via `code-review`
- final evidence gate via `verification-before-completion`

What is still missing is a unified coding workflow that:
- uses these pieces consistently
- maps them to runtime abilities and control-layer obligations
- makes verification and review hard to skip
- records machine-readable execution artifacts

## Design Principles

1. Reuse before inventing:
   - build on existing skills, subagents, and `code_change` controls
   - do not create a second competing coding workflow

2. Evidence before completion:
   - no success claim without fresh validation evidence

3. Structured execution:
   - complex work should produce plan and subtask artifacts, not only chat output

4. Separation of concerns:
   - workflow skills guide the process
   - control layer enforces critical obligations and gates

5. Small-path and large-path support:
   - simple edits should stay lightweight
   - multi-file work should become explicit multi-stage execution

## Existing Assets To Reuse

Primary references:
- `plugins/claude-code/README.md`
- `plugins/claude-code/skills/task-breakdown/SKILL.md`
- `plugins/claude-code/skills/code-execution/SKILL.md`
- `plugins/claude-code/skills/test-generation/SKILL.md`
- `plugins/claude-code/skills/code-review/SKILL.md`
- `plugins/claude-code/skills/verification-before-completion/SKILL.md`
- `packages/plugin-abilities/src/control/obligation-registry.ts`

Current reusable patterns:
- 6-stage workflow already defined for development tasks
- subtask JSON artifact pattern already exists
- `code_change` control type already exists
- review and verification standards are already explicit in skills

## Target Workflow

### Stage 1: Analyze

Purpose:
- understand request, scope, affected surfaces, and risk

Required actions:
- inspect relevant files
- identify whether task is simple or complex
- identify likely verification commands

Outputs:
- affected files list
- verification plan draft
- complexity classification

### Stage 2: Plan

Purpose:
- create an implementation plan with acceptance criteria

Simple path:
- inline plan in execution metadata is enough

Complex path:
- create task and subtask artifacts using task-breakdown pattern

Outputs:
- task objective
- acceptance criteria
- deliverables
- dependency order

### Stage 3: Load Context

Purpose:
- preload standards, patterns, and reference files before coding

Required actions:
- load relevant standards
- load reference files
- avoid nested rediscovery during execution

Outputs:
- context file list
- reference file list

### Stage 4: Execute

Purpose:
- implement changes in a controlled path

Simple path:
- direct implementation for small isolated changes

Complex path:
- execute subtasks one by one or in safe parallel groups

Outputs:
- implementation artifact
- changed files list
- acceptance-criteria progress

### Stage 5: Validate

Purpose:
- prove the change works with fresh evidence

Required actions:
- run targeted tests
- run lint/build/typecheck when applicable
- verify user-facing symptom or acceptance criteria

Outputs:
- validation report artifact
- command list
- exit codes
- summary of pass/fail status

### Stage 6: Review and Complete

Purpose:
- perform final quality gate before claiming completion

Required actions:
- code review
- verification-before-completion check
- summarize residual risks and outcomes

Outputs:
- review report artifact
- final completion summary

## Small Path vs Complex Path

### Small Path

Use when:
- touches 1 to 3 files
- low architectural risk
- no natural parallelization

Required minimum:
- analyze
- direct plan
- execute
- validate
- review before completion

Artifacts may be compact but must still record:
- affected files
- validation commands
- review outcome

### Complex Path

Use when:
- touches 4 or more files
- crosses components or layers
- has subtasks with dependencies
- has meaningful test/review scope

Required minimum:
- task breakdown artifact
- subtask artifacts
- explicit deliverables
- explicit dependency graph
- per-subtask validation and final review

## Target Artifacts

The coding workflow should produce these artifact types.

### 1. Task Plan

Purpose:
- capture objective, deliverables, context, and exit criteria

Suggested fields:
- `task_id`
- `objective`
- `context_files`
- `reference_files`
- `acceptance_criteria`
- `deliverables`
- `complexity`
- `subtask_count`

### 2. Subtask Record

Purpose:
- track atomic execution units for complex work

Suggested fields:
- `subtask_id`
- `title`
- `depends_on`
- `parallel`
- `status`
- `deliverables`
- `acceptance_criteria`
- `agent`

### 3. Implementation Result

Purpose:
- describe what changed and what was completed

Suggested fields:
- `task_id`
- `changed_files`
- `deliverables_completed`
- `acceptance_criteria_status`
- `implementation_summary`

### 4. Validation Report

Purpose:
- store evidence, not just claims

Suggested fields:
- `task_id`
- `commands`
- `results`
- `exit_codes`
- `coverage` when available
- `failures`
- `validated_claims`

### 5. Review Report

Purpose:
- store review findings and verdict

Suggested fields:
- `task_id`
- `review_scope`
- `blocking_findings`
- `non_blocking_findings`
- `positive_observations`
- `verdict`

### 6. Completion Summary

Purpose:
- communicate final state to user or orchestrator

Suggested fields:
- `task_id`
- `status`
- `validated`
- `reviewed`
- `remaining_risks`
- `next_actions`

## Recommended Runtime Model

The coding workflow should be expressed using:
- skills/subagents for orchestration and specialized execution
- abilities for enforced runtime steps
- control layer for obligations and gates

### Recommended Task Type

Reuse:
- `task_type: code_change`

Do not create a brand new task type unless the repository needs a second coding mode with materially different enforcement.

## Obligations

The current `code_change` obligations are too thin. Keep them and extend them.

### Existing Obligations To Keep

- `run_tests`
- `record_validation`
- `commit_if_required`

### New Obligations To Add

#### `requirements_checked`

Meaning:
- the agent explicitly checked the requested scope and acceptance criteria

Required evidence:
- accepted checklist or recorded criteria

#### `affected_files_identified`

Meaning:
- the workflow recorded the files or surfaces expected to change

Required evidence:
- affected files artifact or metadata

#### `implementation_recorded`

Meaning:
- code changes were summarized in machine-readable form

Required evidence:
- implementation result artifact

#### `review_completed`

Meaning:
- code review was actually performed before completion

Required evidence:
- review artifact or structured review event

#### `verification_evidence_recorded`

Meaning:
- final completion claims are backed by fresh command output

Required evidence:
- validation report with commands and exit codes

## Gates

These gates should be implemented on top of obligations and artifact inspection.

### `validation_gate`

Block when:
- required validation command was not run
- validation failed
- success is claimed without fresh evidence

### `review_gate`

Block when:
- required review was skipped
- blocking findings remain unresolved

### `scope_gate`

Warn or block when:
- changed files and final output do not match declared task scope
- implementation drifts from stated objective

### `completion_claim_gate`

Block when:
- workflow attempts to mark complete without validation evidence and review status

### `subtask_dependency_gate`

Block when:
- a subtask is executed before its dependencies are satisfied

This gate applies only to complex path execution.

## Workflow-to-Control Mapping

### Analyze
- obligations:
  - `requirements_checked`
  - `affected_files_identified`

### Plan
- obligations:
  - `requirements_checked`
  - `artifact_lineage_recorded` if task artifacts are introduced later

### Load Context
- no major hard obligation needed by default
- keep as workflow discipline unless repository wants stricter enforcement

### Execute
- obligations:
  - `implementation_recorded`

### Validate
- obligations:
  - `run_tests`
  - `record_validation`
  - `verification_evidence_recorded`
- gates:
  - `validation_gate`

### Review and Complete
- obligations:
  - `review_completed`
- gates:
  - `review_gate`
  - `completion_claim_gate`

## Recommended Ability Surface

This plan does not require replacing skills. It recommends adding or refining abilities around them.

Suggested abilities:
- `development/code-plan`
- `development/code-execute`
- `development/code-validate`
- `development/code-review`
- `development/code-complete`

Alternative:
- keep one higher-level `development/code-change` ability with internal step orchestration

Preferred initial approach:
- start with one high-level ability for `code_change`
- add smaller abilities only if nested workflow execution becomes stable and necessary

## Workstreams

### WS1: Define Coding Artifact Contract

Objective:
- standardize the machine-readable artifacts for coding work

Target files:
- new coding artifact module under `packages/plugin-abilities/src/`
- tests for artifact serialization and loading
- optional `.tmp/tasks/` compatibility bridge

Implementation tasks:
1. Define artifact schemas for task plan, implementation result, validation report, and review report.
2. Decide whether to reuse `.tmp/tasks/` directly or introduce a runtime store that can mirror it.
3. Add tests for artifact creation and retrieval.

Acceptance criteria:
1. Complex tasks can be represented without relying only on freeform text.
2. Validation and review results have structured storage.

### WS2: Harden `code_change` Obligations

Objective:
- extend the current `code_change` control model to cover real coding completion

Target files:
- `packages/plugin-abilities/src/control/obligation-registry.ts`
- `packages/plugin-abilities/src/control/index.ts`
- control tests

Implementation tasks:
1. Add the new coding obligations listed above.
2. Support artifact-based and event-based satisfaction, not tags only.
3. Keep backward compatibility for older code-change abilities where possible.

Acceptance criteria:
1. `code_change` no longer passes solely because a test-tagged step exists.
2. Review and verification evidence can be enforced.

### WS3: Build the High-Level Coding Ability

Objective:
- create an enforced runtime path for code changes

Target files:
- new ability YAML under `.opencode/abilities/development/`
- plugin wiring if command exposure is needed
- relevant tests

Implementation tasks:
1. Add a high-level coding ability for `code_change`.
2. Support small path and complex path branching.
3. Ensure validation is a real stage, not a suggestion.

Acceptance criteria:
1. There is a deterministic code-change execution path.
2. Validation and completion are explicit stages.

### WS4: Integrate Review and Verification Skills

Objective:
- make review and final verification first-class workflow gates

Target files:
- ability definitions
- executor support if needed
- tests

Implementation tasks:
1. Map review stage to structured review artifact output.
2. Map verification-before-completion to structured validation evidence checks.
3. Ensure completion is blocked if either review or final verification is missing.

Acceptance criteria:
1. Completion claims require fresh verification evidence.
2. Blocking review findings prevent workflow completion.

### WS5: Add Complex Task Decomposition Support

Objective:
- align runtime coding workflow with existing task-breakdown pattern

Target files:
- ability definitions
- executor or store support
- test coverage

Implementation tasks:
1. Detect when a task should enter complex path.
2. Create task and subtask artifacts compatible with existing task-breakdown skill.
3. Enforce subtask dependency order.
4. Allow safe parallel execution for isolated subtasks only.

Acceptance criteria:
1. Multi-file work can be represented and executed as subtasks.
2. Dependency violations are blocked.

Implementation mapping (2026-03-18):
- Complex-path detection is implemented in the high-level ability via `inputs.path` and explicit `plan-complex-subtasks` stage in `.opencode/abilities/development/code-change/ability.yaml`.
- Task/subtask artifact compatibility bridge is implemented at `packages/plugin-abilities/src/coding/task-breakdown-bridge.ts` via `writeTaskBreakdownArtifacts(...)`, generating:
  - `.tmp/tasks/{feature}/task.json`
  - `.tmp/tasks/{feature}/subtask_01.json`, `subtask_02.json`, ...
- Subtask dependency enforcement is implemented through structured evidence + gate evaluation:
  - evidence extraction includes `subtasks`, `dependency_graph`, `dependency_violations`
  - `subtask_dependency_gate` blocks when `dependency_violations` is non-empty
- Safe parallel execution support is represented via complex-path `execution_mode` (`serial` | `parallel_safe`) and per-subtask `parallel` metadata in ability output.

Verification coverage (2026-03-18):
- `packages/plugin-abilities/tests/development-code-change-ability.test.ts`
  - validates complex-path execution and dependency-violation block scenario
- `packages/plugin-abilities/tests/control.test.ts`
  - validates `subtask_dependency_gate` blocks from structured evidence
- `packages/plugin-abilities/tests/task-breakdown-bridge.test.ts`
  - validates `.tmp/tasks` compatibility artifacts (`task.json` + ordered `subtask_XX.json`)

### WS6: Add Final User-Facing Completion Contract

Objective:
- ensure final reporting is honest, evidence-based, and concise

Target files:
- completion summary formatter
- tests for completion claims

Implementation tasks:
1. Make final completion output depend on validation and review artifacts.
2. Include residual risks and missing checks when work is partial.
3. Prevent "done" language when evidence is incomplete.

Acceptance criteria:
1. Final summary cannot overstate completion.
2. Partial work is reported explicitly as partial.

## Suggested Delivery Order

Phase 1:
- WS1 artifact contract
- WS2 harden `code_change`

Phase 2:
- WS3 high-level coding ability
- WS4 review and verification integration

Phase 3:
- WS5 complex task decomposition
- WS6 completion contract

Reason:
- artifacts and obligations must exist before a trustworthy coding ability can be enforced

## Minimum Viable Version

If scope is constrained, ship this first:
1. extend `code_change` obligations
2. add structured validation report
3. add structured review report
4. add `validation_gate`
5. add `review_gate`
6. block completion without fresh verification evidence

This gives the highest leverage with the least system churn.

## Test Plan

Required test categories:
- control tests for `code_change`
- artifact serialization tests
- integration tests for high-level coding ability
- completion-claim tests

Required scenarios:
1. tests were not run, but workflow tries to complete
   - expected: blocked
2. tests ran and passed, but review was skipped
   - expected: blocked or warned by policy
3. review found blocking issue
   - expected: blocked
4. small path task completes with valid evidence
   - expected: allowed
5. complex path subtask runs before dependency completion
   - expected: blocked

## Documentation Updates Required

Update after implementation:
- `plugins/claude-code/README.md`
- any new development ability docs
- control-layer docs describing `code_change`

Documentation must clarify:
- what remains workflow guidance
- what is enforced by runtime controls
- what evidence is required before completion claims

## Risks

- Risk: duplicating existing skill behavior in a second system
  - Mitigation: reuse current skills and keep control layer focused on enforcement.

- Risk: making small edits too heavy
  - Mitigation: keep small path lightweight and reserve decomposition for complex tasks.

- Risk: overfitting to current Claude Code plugin layout
  - Mitigation: define generic coding artifacts and generic `code_change` gates.

## Definition of Done

This plan is complete when:
1. coding tasks can follow a deterministic runtime path
2. complex work can be decomposed into auditable subtasks
3. `code_change` enforces real review and verification obligations
4. completion claims require fresh evidence
5. final user-facing summaries reflect actual validated state, not optimistic assumptions

## Delegation Request (TaskManager)

Break this plan into atomic engineering tasks with dependencies. Start with artifact contract and `code_change` obligation hardening. Do not start with subtask parallelization before completion gates and validation artifacts are in place.
