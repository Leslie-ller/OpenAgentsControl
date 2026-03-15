# Control Layer MVP

This package now includes a minimal fail-closed control layer for `ability.run`.

## What the MVP does

- Emits structured control events during execution
- Evaluates obligations for `code_change`
- Produces a final gate verdict:
  - `allow`
  - `warn`
  - `block`
- Fails closed at the end of `ability.run` when the final verdict is `block`
- Stops early during execution when a hard obligation has clearly failed

## Current obligation set

The MVP currently evaluates only `TaskType = code_change`.

- `run_tests` (hard)
- `record_validation` (hard)
- `commit_if_required` (soft)

## Prefer explicit tags

Use explicit step tags when the step is meant to satisfy an obligation.

```yaml
steps:
  - id: execute-suite
    type: script
    run: echo "suite executed"
    tags:
      - test
    validation:
      exit_code: 0

  - id: persist-changes
    type: script
    run: echo "saved metadata"
    tags:
      - commit
```

Supported MVP tags:

- `test`
- `commit`

If no matching tag is present, the control layer falls back to command and step-id heuristics for backward compatibility.

## Reading the result

`ability.run` now returns two status fields:

- `execution.status`
  - The raw executor result
- `status`
  - The final public result after applying the completion gate

Interpret them like this:

- `execution.status = completed` and `status = failed`
  - The workflow ran to completion, but the gate rejected it
- `execution.status = completed` and `status = completed`
  - The workflow completed and the gate allowed or warned

The control payload includes:

- `control.gate`
- `control.midRunGate.latest`
- `control.midRunGate.history`
- `control.obligations`
- `control.modelAudit`
- `control.eventCount`

## Gate semantics

- `block`
  - At least one hard obligation is unsatisfied or failed
  - Final `status` is `failed`
- `warn`
  - All hard obligations are satisfied
  - One or more soft obligations are unsatisfied or failed
  - Final `status` remains successful
- `allow`
  - All current obligations are satisfied

## Mid-run enforcement v1

The current plugin wiring also performs a conservative mid-run stop.

- It only stops early when the in-flight gate shows a **hard failure**
- It does **not** stop on temporary `missing` / `expected` states that may still be satisfied by later steps

This matters because normal workflows often pass through temporary unsatisfied states before validation and commit evidence have been observed.

## Demo abilities

See:

- `examples/control-mvp-pass/ability.yaml`
- `examples/control-mvp-block/ability.yaml`

The pass example uses explicit tags and validation.
The block example shows a workflow that executes successfully but is rejected by the gate because required test and validation evidence is missing.

## Current MVP boundaries

- Only supports `TaskType = code_change`
- Mid-run enforcement is limited to explicit hard failures
- Still uses heuristics as a fallback
- Does not yet include external-action obligations such as Zotero writes

## Model drift audit

Agent steps can optionally declare an expected model and provider:

```yaml
- id: review
  type: agent
  agent: reviewer
  model: gpt-5.4
  provider: openai
  prompt: Review the changes
```

If the executor context returns actual model metadata for the agent call, the control layer records it in `control.modelAudit`.

Current behavior:

- model drift is **audited**
- model drift does **not** yet change gate verdicts

This keeps model policy separate from the current obligation gate.
