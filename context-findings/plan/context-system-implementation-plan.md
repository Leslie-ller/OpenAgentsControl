# Context System Implementation Plan

Status: draft
Owner: repository-manager
Last Updated: 2026-02-14

## Goal

Make context management simple, reliable, and efficient by standardizing file governance, introducing ADR-style decision memory, and adding lightweight CLI/agent workflows with strict validation.

## Scope

This plan covers:
- Context file standards and lifecycle governance
- ADR migration from single decision log to index + per-record files
- Simple command surface for creation, validation, and health checks
- Agent workflow integration (ContextScout + TaskManager + DocWriter)
- CI and local validation gates

This plan does not make SQLite primary storage. Files remain source of truth.

## Fundamental Principles

1. File-first truth: markdown context files are canonical.
2. Deterministic operations: same input files => same validation/index outcomes.
3. Minimal Viable Information: concise, scannable, reference-heavy.
4. Navigation-first retrieval: load index/navigation before deep files.
5. Least privilege and conflict safety: explicit permissions and supersession rules.

## Target Outcomes

- Standardized metadata and structure across context files
- ADR system in place with conflict/supersession protection
- One-command validation for local + CI use
- Reduced token load via index-first retrieval patterns
- Clear ownership and freshness maintenance cadence

## Workstreams

### WS1: Standards Baseline
- Define required metadata contract and file constraints
- Align with existing context-system standards and MVI
- Publish single operating standard doc

### WS2: ADR Refactor
- Create decisions index and ADR directory structure
- Define ADR template and status lifecycle
- Migrate key decisions from legacy decisions log
- Enforce supersession updates for conflicting decisions

### WS3: CLI + Workflow
- Define `ctx` command set (add, validate, check, adr new, adr supersede, stale)
- Integrate agent preflight (`ctx validate --changed`) for context edits
- Keep backend file-based (no DB dependency required)

### WS4: Validation + Governance
- Add local validation script and CI gates
- Validate metadata, links, line limits, navigation presence, ADR index integrity
- Add review cadence and ownership coverage rules

## Proposed Artifacts

- `context-findings/plan/CONTEXT_OPERATING_STANDARD.md`
- `context-findings/plan/ADR_STANDARD.md`
- `context-findings/plan/CLI_COMMAND_SPEC.md`
- `context-findings/plan/VALIDATION_CHECKLIST.md`
- `context-findings/plan/ROLL_OUT_PLAN.md`

## Acceptance Criteria

1. Standards docs are complete and internally consistent.
2. ADR model supports conflict-safe supersession flow.
3. Validation checklist is executable in local and CI contexts.
4. Command specs are clear enough for implementation without ambiguity.
5. Rollout plan includes phases, owners, and measurable KPIs.

## Initial KPI Set

- 100% context files pass required metadata checks
- 100% active folders include `navigation.md`
- 0 unresolved ADR conflicts/supersession gaps
- 100% critical/high context files reviewed within cadence window

## Risks and Mitigations

- Risk: Overly complex process
  - Mitigation: keep command surface minimal and defaults opinionated.
- Risk: Drift between standards and usage
  - Mitigation: enforce CI validation and monthly drift review.
- Risk: Agent confusion from conflicting ADRs
  - Mitigation: strict supersession policy and index integrity checks.

## Delegation Request (TaskManager)

Break this plan into atomic execution subtasks with dependencies, owners, and acceptance criteria. Prioritize standards and validation first, then ADR migration, then workflow/command integration.
