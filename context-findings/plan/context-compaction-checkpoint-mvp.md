# Context Compaction Checkpoint MVP

Status: draft
Owner: repository-manager
Last Updated: 2026-03-18

## Goal

Build a minimal runtime context system for OpenCode-based agents that prevents important information from being lost:
- before OpenCode compacts the session context
- before the model's attention drifts away from the active task even when compaction has not happened yet

This MVP is intentionally narrow.

It does not try to build a full memory system, a durable workflow engine, or a generalized knowledge graph.
It only solves:
- retain the current task state
- retain critical details before compaction
- re-inject the right amount of retained context at the right time

## Problem

There are two distinct failure modes in long agent runs:

1. **Attention drift before compaction**
- the relevant information is still technically inside the model context window
- but it is no longer salient enough for the model to reliably use

2. **Detail loss during compaction**
- OpenCode compacts the conversation into a smaller summary
- provider-side summarization can drop implementation-critical details

This MVP addresses both failure modes with two separate mechanisms:
- `Focus Refresh`
- `Compaction Checkpoint`

## Design Principles

1. Use OpenCode's compaction hook instead of guessing when compaction happens.
2. Keep retained context small by default.
3. Separate "state needed to continue" from "details needed to recover".
4. Do not rely on provider compaction quality.
5. Do not inject all retained details back into the main context by default.

## OpenCode Assumption

This plan assumes OpenCode exposes the `experimental.session.compacting` plugin hook and compaction-related config.

Implementation must verify against the real OpenCode plugin API before merging.

## MVP Mechanisms

### Mechanism A: Focus Refresh

Purpose:
- keep the current task salient before context compaction happens

Behavior:
- inject a very small retained state block back into the active context at specific attention-risk moments
- do not run a full checkpoint
- do not inject all retained details

### Mechanism B: Compaction Checkpoint

Purpose:
- preserve both current state and implementation-critical details before OpenCode compacts the session

Behavior:
- generate two retained capsules before compaction
- save them to a store keyed by `topic`
- inject the relevant checkpoint summary into the compaction prompt

## Object Model

MVP uses only two retained objects.

### 1. State Capsule

This is the default reinjection unit.

Suggested fields:
- `topic`
- `current_state`
- `based_on`
- `next_action`
- `open_questions`
- `key_constraints`
- `updated_at`

Purpose:
- allow the next agent turn or next workflow stage to continue without rereading the entire session

### 2. Detail Capsule

This is the recovery unit for details likely to be lost during compaction.

Suggested fields:
- `topic`
- `critical_details`
- `decisions`
- `evidence`
- `file_refs`
- `commands_run`
- `unresolved_edges`
- `updated_at`

Purpose:
- recover details that should not be forced into every future prompt

## Topic Model

Each retained context entry must belong to a single stable `topic`.

Examples:
- `coding-workflow`
- `bibliography-remediation`
- `openagentscontrol-fork-review`

Rules:
1. one long-running task = one topic
2. repeated work on the same active thread should update the same topic
3. topic IDs must be stable and slug-like

## Trigger Model

### Trigger A: Focus Refresh

Fire on:
1. workflow stage transition
2. return from subagent execution to the main agent
3. after large tool output blocks
4. before high-impact decisions such as code edits, task closure, or final recommendations

Do not:
- store a new detail checkpoint unless the compaction trigger also fires

### Trigger B: Compaction Checkpoint

Fire on:
1. `experimental.session.compacting`

Optional secondary triggers:
1. session end
2. explicit handoff between agents

## Runtime Flow

## Flow 1: Task Start / Resume

1. Resolve active `topic`.
2. Load latest `State Capsule` for the topic.
3. Inject `State Capsule` into the current run.
4. Do not inject `Detail Capsule` by default.

## Flow 2: Focus Refresh

1. Runtime detects a focus-risk trigger.
2. Load latest `State Capsule` for the current topic.
3. Inject a short `Current Focus` block into the active context.
4. Continue normal execution.

Example injected block:

```yaml
Current Focus:
topic: coding-workflow
current_state: Coding workflow plan exists and implementation has not started.
next_action: Start artifact contract and code_change obligation hardening.
open_questions:
  - Whether to begin with one high-level ability or multiple smaller abilities
key_constraints:
  - Keep the MVP lightweight
```

## Flow 3: Compaction Checkpoint

1. OpenCode fires `experimental.session.compacting`.
2. Resolve current topic.
3. Extract a new `State Capsule`.
4. Extract a new `Detail Capsule`.
5. Save both under the topic.
6. Inject a checkpoint summary into the compaction prompt.
7. Allow OpenCode compaction to proceed.

## Flow 4: Post-Compaction Recovery

1. Normal execution resumes on the compacted conversation.
2. Default recovery behavior:
   - inject `State Capsule` only
3. If needed, inject part of the `Detail Capsule` according to the reinjection policy.

## Reinjection Policy

### Default Reinjection

Inject only:
- `State Capsule`

### Conditional Detail Reinjection

Inject selected fields from `Detail Capsule` only when needed:

- continue implementation:
  - `critical_details`
  - `decisions`

- explain earlier reasoning:
  - `decisions`
  - `evidence`

- recover execution context:
  - `file_refs`
  - `commands_run`

- resolve pending work:
  - `unresolved_edges`

### Rule

Never inject the entire detail capsule by default.

## Extraction Contract

The checkpoint system should request retained content from the agent in a structured format.

### State Extraction Prompt

Requirements:
- short
- current-state oriented
- no long narrative

Expected output fields:
- `topic`
- `current_state`
- `based_on`
- `next_action`
- `open_questions`
- `key_constraints`
- `updated_at`

### Detail Extraction Prompt

Requirements:
- preserve critical details only
- no full reasoning transcript
- no generic repetition

Expected output fields:
- `topic`
- `critical_details`
- `decisions`
- `evidence`
- `file_refs`
- `commands_run`
- `unresolved_edges`
- `updated_at`

## Storage Model

MVP storage is intentionally simple.

Per topic, store exactly:
- `state/<topic>`
- `detail/<topic>`

Behavior:
- latest write replaces previous value
- no version tree
- no event sourcing
- no search index required for MVP

## Prompt Injection Contract

### Focus Refresh Injection

Inject a very short state block into the active prompt context.

Hard rule:
- keep it smaller than the compaction checkpoint injection

### Compaction Prompt Injection

Inject two compact blocks:

1. `Checkpoint Context`
- derived from `State Capsule`

2. `Critical Details To Preserve`
- derived from a short projection of `Detail Capsule`

Example:

```yaml
Checkpoint Context:
topic: bibliography-remediation
current_state: Remediation plan exists and runtime wiring has not started.
based_on:
  - bibliography-control-remediation-plan.md
next_action: Start WS1 runtime wiring through BibliographyPipeline.
open_questions:
  - Whether WS1 and WS2 should be implemented together
key_constraints:
  - Do not redesign generic controls before wiring the real runtime path
```

```yaml
Critical Details To Preserve:
- Existing runtime already has BibliographyPipeline and BibliographyStore library code
- Current plugin and SDK routing still bypass the pipeline
- Key refs: packages/plugin-abilities/src/opencode-plugin.ts, packages/plugin-abilities/src/sdk.ts
```

## MVP Components

### 1. `TopicResolver`

Responsibility:
- derive the active topic for the current session or task

### 2. `CheckpointStore`

Responsibility:
- load and save `State Capsule` and `Detail Capsule`

### 3. `FocusRefreshManager`

Responsibility:
- detect focus-risk triggers
- inject `State Capsule` summaries into active context

### 4. `CompactionCheckpointManager`

Responsibility:
- handle `experimental.session.compacting`
- produce state/detail capsules
- write them to store
- augment the compaction prompt

### 5. `DetailReinjector`

Responsibility:
- selectively inject the right detail subset after compaction or resume

## Recommended File Targets

Because the exact plugin implementation may differ, keep target files flexible.

Likely implementation locations:
- `packages/plugin-abilities/src/` if integrated into abilities/control runtime
- `.opencode/plugin/` if implemented as project plugin behavior
- supporting docs under `context-findings/plan/` and/or plugin docs

Recommended code modules:
- `runtime/context/topic-resolver.ts`
- `runtime/context/checkpoint-store.ts`
- `runtime/context/focus-refresh.ts`
- `runtime/context/compaction-checkpoint.ts`
- `runtime/context/detail-reinjector.ts`

These names are suggestions, not mandatory.

## Workstreams

### WS1: Confirm Hook Surface and Define Integration Point

Objective:
- verify the real OpenCode plugin API for compaction hooks and prompt mutation

Tasks:
1. Confirm `experimental.session.compacting` behavior against real API.
2. Confirm how to inject additional prompt context at compaction time.
3. Confirm whether focus refresh should happen via message injection, system context injection, or another runtime path.

Acceptance criteria:
1. Real integration point is verified against code or official docs.
2. Implementation path is chosen and documented.

### WS2: Implement Topic Resolution and Checkpoint Store

Objective:
- establish the minimal persistence needed for retained context

Tasks:
1. Implement stable topic resolution.
2. Implement read/write for `state/<topic>` and `detail/<topic>`.
3. Add tests for overwrite semantics and topic isolation.

Acceptance criteria:
1. Multiple topics do not collide.
2. Latest topic state is readable at session start or resume.

### WS3: Implement Focus Refresh

Objective:
- address attention drift before compaction

Tasks:
1. Define focus-risk trigger points.
2. Implement short state reinjection.
3. Ensure detail capsules are not injected by default.

Acceptance criteria:
1. State can be reintroduced without requiring a full checkpoint cycle.
2. Injection remains short and stable.

### WS4: Implement Compaction Checkpoint

Objective:
- preserve state and details before compaction

Tasks:
1. Build state/detail extraction prompts.
2. Generate capsules before compaction.
3. Save both capsules.
4. Inject checkpoint summary into compaction prompt.

Acceptance criteria:
1. A compaction event produces updated state and detail capsules.
2. Compaction prompt includes checkpoint preservation instructions.

### WS5: Implement Conditional Detail Reinjection

Objective:
- recover details without overloading the compacted prompt

Tasks:
1. Implement reinjection selectors for implementation, evidence, command history, and unresolved edges.
2. Define call sites that request selective detail reinjection.
3. Add tests for partial reinjection behavior.

Acceptance criteria:
1. The system can restore only the necessary detail subset.
2. Default behavior remains state-only.

## Test Plan

Required scenarios:

1. **Attention drift scenario**
- large tool output occurs
- focus refresh injects state capsule
- main task remains explicit

2. **Compaction scenario**
- compaction hook fires
- state/detail capsules are generated and saved
- compaction prompt includes checkpoint data

3. **Resume scenario**
- new session resumes same topic
- latest state capsule is injected automatically

4. **Detail recovery scenario**
- state is insufficient
- system injects only the relevant detail subset

5. **Topic isolation scenario**
- multiple active topics exist over time
- state and detail records do not cross-contaminate

## Minimum Viable Shipping Scope

Ship only this first:
1. topic resolution
2. state capsule store
3. focus refresh using state capsule
4. compaction hook support
5. detail capsule generation and storage
6. compaction prompt augmentation

Defer:
- detail reinjection heuristics beyond a minimal selector
- version history
- long-term memory
- generalized workflow integration

## Risks

- Risk: focus refresh becomes noisy
  - Mitigation: limit triggers to stage changes, subagent returns, large tool outputs, and pre-decision moments.

- Risk: compaction prompt augmentation grows too large
  - Mitigation: inject short state plus only a tiny projection of detail.

- Risk: topic resolution becomes unstable
  - Mitigation: define explicit fallback ordering and test it.

- Risk: retained details become bloated
  - Mitigation: treat detail capsule as "critical recovery facts", not transcript storage.

## Definition of Done

This MVP is complete when:
1. the runtime can inject short focus state before attention drift causes practical loss of task salience
2. the runtime can capture state and critical details before OpenCode compaction
3. post-compaction execution can continue with restored task direction
4. details can be selectively recovered when needed without reloading the full session history

## Delegation Request (TaskManager)

Break this plan into atomic implementation tasks. Prioritize real hook verification first, then store + focus refresh, then compaction checkpoint, then selective detail reinjection.

---

## Implementation Progress (2026-03-18)

### WS1: Hook Surface and Integration Point — implemented

- Verified event surface from local OpenCode plugin docs (`dev/ai-tools/opencode/building-plugins.md`):
  - `session.compacted` event is available and can be handled in plugin `event(...)` hook.
  - `chat.message` hook supports prompt/context augmentation.
- Integration path selected in plugin runtime:
  - compaction checkpoint writes are attached to `session.compacted` handling in `packages/plugin-abilities/src/opencode-plugin.ts`.
  - focus-refresh text can be surfaced via runtime status path and chat injection hook.

### WS2: Topic Resolution and Checkpoint Store — implemented

- Added `TopicResolver`:
  - `packages/plugin-abilities/src/runtime/context/topic-resolver.ts`
  - exports `resolveTopicFromExecution(...)`
- Added `CheckpointStore` with isolated state/detail namespaces and overwrite semantics:
  - `packages/plugin-abilities/src/runtime/context/checkpoint-store.ts`
  - storage roots: `state/<topic>.json`, `detail/<topic>.json`

### WS3: Focus Refresh — implemented (MVP)

- Added short state reinjection formatter:
  - `packages/plugin-abilities/src/runtime/context/focus-refresh.ts`
  - exports `renderFocusRefreshBlock(...)`
- Wired focus refresh into plugin chat injection path during active execution:
  - `packages/plugin-abilities/src/opencode-plugin.ts`
  - `chat.message` now prepends a short focus block when topic state exists
- Detail capsule is not injected by default.

### WS4: Compaction Checkpoint — implemented (MVP)

- Added checkpoint generation + persistence + compaction summary rendering:
  - `packages/plugin-abilities/src/runtime/context/compaction-checkpoint.ts`
  - exports `createCompactionCheckpoint(...)`
- Plugin integrates compaction event handling (`session.compacted`) and stores fresh checkpoints before continuing runtime flow.
- Added post-compaction recovery injection path:
  - `session.compacted` stores pending checkpoint summary by session key
  - `chat.message` injects one-shot `Post-Compaction Recovery` block on next turn

### WS5: Conditional Detail Reinjection — implemented (MVP)

- Added selective detail projection by use case:
  - `packages/plugin-abilities/src/runtime/context/detail-reinjector.ts`
  - exports `selectDetailFields(...)`
- Added reinjection block renderer and plugin tool-level integration:
  - `renderDetailReinjectionBlock(...)` renders selected fields for prompt injection
  - `ability.context.detail` tool exposes topic-scoped conditional detail selection at runtime
- Supported selectors:
  - `continue_implementation`
  - `explain_reasoning`
  - `recover_execution_context`
  - `resolve_pending_work`

### Test Coverage (MVP)

- Added test suite:
  - `packages/plugin-abilities/tests/context-checkpoint-mvp.test.ts`
- Covered scenarios:
  1. stable topic resolution and fallback behavior
  2. state/detail overwrite semantics and topic isolation
  3. short focus refresh injection rendering
  4. selective detail reinjection by use case
5. compaction checkpoint creation and store persistence
6. pending checkpoint summary consume-once behavior with session/global fallback and clear semantics
7. detail reinjection block rendering from selected detail fields
