---
description: Run the paper screening stage for bibliography workflows
tags:
  - bibliography
  - screening
  - literature
  - research
dependencies:
  - subagent:contextscout
  - subagent:task-manager
  - tool:bibliography-stack
  - context:bibliography-workflow
  - context:bibliography-paper-screening
  - context:bibliography-paper-screening-task-template
---

# Paper Screening Command

Use this command for the `paper_screening` stage of the bibliography workflow.

## Usage

```bash
/paper-screening {candidate set, search query, or collection name}
```

## Purpose

This is the focused execution entrypoint for the `AGE-30` line: move a candidate set into a small active reading queue using explicit screening criteria.

Load these before planning or execution:

- `.opencode/context/core/workflows/bibliography-workflow.md`
- `.opencode/context/core/workflows/bibliography-paper-screening.md`
- `.opencode/context/openagents-repo/templates/bibliography-paper-screening-task-template.md`

Required tooling:

- `discovery`
- `reference_manager`

Configured through:

- `BIBLIOGRAPHY_DISCOVERY_CMD` or `BIBLIOGRAPHY_SEARCH_CMD`
- `BIBLIOGRAPHY_REFERENCE_MANAGER_CMD`, `BIBLIOGRAPHY_ZOTERO_CMD`, or `ZOTERO_CMD`

## Required Outputs

For each paper:

```markdown
paper_id: {key}
title: {title}
screening_status: keep | defer | reject
screening_reason: {why}
screening_evidence:
- metadata signal 1
- metadata signal 2
next_action: {queue | hold | archive}
```

For the batch:

- screening criteria
- queue size limit
- keep/defer/reject counts
- next review queue

## Execution Rules

1. Screening is metadata-first triage, not full synthesis.
2. `keep` should consume limited queue capacity intentionally.
3. If criteria drift mid-batch, stop and rewrite them before continuing.
4. Do not proceed if discovery or reference-manager tooling is missing.
5. If the batch is large or persistent tracking is needed, use `TaskManager`.

## TaskManager Hand-off

When the request covers a real batch rather than a one-off paper:

1. Call `ContextScout` for local bibliography and writing standards.
2. Use the screening task template as the baseline structure.
3. Create a task bundle whose subtasks separate:
   - define criteria
   - triage candidates
   - produce active queue
   - summarize rejects/deferred items

## Success Criteria

- Screening criteria are explicit.
- The active reading queue is deliberately small.
- Every kept paper has a clear reason.
- Deferred and rejected items remain auditable.
