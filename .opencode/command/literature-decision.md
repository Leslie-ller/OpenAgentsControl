---
description: Run the literature decision stage for bibliography workflows
tags:
  - bibliography
  - decision
  - literature
  - research
dependencies:
  - subagent:contextscout
  - subagent:task-manager
  - tool:bibliography-stack
  - context:bibliography-workflow
  - context:bibliography-literature-decision
  - context:bibliography-decision-card-template
  - context:bibliography-literature-decision-task-template
---

# Literature Decision Command

Use this command for the `literature_decision` stage of the bibliography workflow.

## Usage

```bash
/literature-decision {paper, cluster, reading card set, or evidence pack}
```

Runtime ability: `research/literature-decision`

## Purpose

This is the focused execution entrypoint for the `AGE-32` line: turn reviewed papers into explicit keep/defer/reject/revisit decisions with writing-relevant roles.

Load these before planning or execution:

- `.opencode/context/core/workflows/bibliography-workflow.md`
- `.opencode/context/core/workflows/bibliography-literature-decision.md`
- `.opencode/context/openagents-repo/templates/bibliography-decision-card-template.md`
- `.opencode/context/openagents-repo/templates/bibliography-literature-decision-task-template.md`

Required tooling:

- AgentOS Zotero integration

Validated against:

- `/home/leslie/code/AgentOS/.venv/bin/agentos`
- `ZOTERO_USER_ID` and `ZOTERO_API_KEY` in `/home/leslie/code/AgentOS/.env`

## Required Outputs

For each paper or paper cluster:

```markdown
paper_id: {key}
title: {title}
decision: keep | defer | reject | revisit_later
paper_role: {core support | method support | related work | background | none}
decision_reason: {why}
decision_evidence:
- support point 1
- support point 2
tradeoffs:
- gain
- loss
next_action: {cite now | compare later | archive | monitor}
```

For the batch:

- keep/defer/reject counts
- role distribution
- redundancy notes
- hand-off recommendation toward evidence pack or citation audit

## Execution Rules

1. Decisions must be traceable back to screening or full-text evidence.
2. Kept papers need narrow roles, not vague “important” labels.
3. Rejections should be explicit and auditable.
4. Do not proceed if AgentOS Zotero tooling is missing.
5. If uncertainty remains meaningful, prefer `defer` or `revisit_later` over false confidence.

## TaskManager Hand-off

When the request covers multiple papers or persistent decision tracking:

1. Call `ContextScout` for bibliography, citation, and writing standards.
2. Use the decision card template for per-paper or per-cluster outputs.
3. Use the literature decision task template for task planning.
4. Separate subtasks into:
   - review evidence inputs
   - assign decision state and role
   - produce decision cards
   - summarize carry-forward actions

## Success Criteria

- Every active paper has an explicit decision state.
- Kept papers have bounded roles.
- Deferred papers have revisit conditions.
- Decision outputs are reusable by downstream writing or citation audit work.
