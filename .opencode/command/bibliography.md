---
description: Orchestrate bibliography workflows from candidate pool to citation-ready decisions
tags:
  - bibliography
  - literature
  - research
  - workflow
dependencies:
  - subagent:contextscout
  - subagent:task-manager
  - tool:bibliography-stack
  - context:bibliography-workflow
  - context:bibliography-paper-screening
  - context:bibliography-fulltext-review
  - context:bibliography-literature-decision
---

# Bibliography Workflow Command

Use this command to run a staged literature workflow instead of treating paper handling as a flat backlog.

## Usage

```bash
/bibliography plan {topic or research question}
/bibliography screening {candidate set or query}
/bibliography review {paper or shortlist}
/bibliography decision {paper, cluster, or evidence pack}
/bibliography audit {draft section or citation set}
```

## Runtime Ability Mapping

When this workflow is executed through `plugin-abilities`, route stages to:

- `screening` -> `research/paper-screening`
- `review` -> `research/paper-fulltext-review`
- `decision` -> `research/literature-decision`
- `audit` -> `research/citation-audit`

## Purpose

This command gives OpenAgents Control a single execution entrypoint for bibliography-heavy work. It aligns with the staged workflow in:

- `.opencode/context/core/workflows/bibliography-workflow.md`
- `.opencode/context/core/workflows/bibliography-paper-screening.md`
- `.opencode/context/core/workflows/bibliography-fulltext-review.md`
- `.opencode/context/core/workflows/bibliography-literature-decision.md`

## Tool Contract

Before non-trivial execution, verify the local AgentOS bibliography toolchain is actually available:

- academic discovery via `/home/leslie/code/AgentOS/.venv/bin/agentos search --mode academic`
- Zotero access via `/home/leslie/code/AgentOS/.venv/bin/agentos zotero-search` and `zotero-read`
- full-text extraction via AgentOS MinerU adapters exposed through `/home/leslie/code/AgentOS/.venv/bin/agentos-mcp`

Stage gates:

- `screening` requires AgentOS academic search and Zotero
- `review` requires AgentOS MCP plus Zotero and MinerU
- `decision` requires Zotero
- `audit` requires Zotero

If the relevant capability is missing, stop and report the missing tool instead of silently improvising around it.

## Core Model

Always think in these layers:

1. `literature_pool`
2. `active_reading_queue`
3. `paper_reading_card`
4. `section_evidence_pack`
5. `citation_audit`

Do not skip directly from a large literature pool to draft writing unless the user explicitly asks for a shortcut.

## Stage Routing

### `/bibliography plan`

Use when the user needs a workflow plan or when the literature task is still underspecified.

Process:
1. Call `ContextScout` to find local citation, review, and workflow patterns.
2. Load bibliography workflow contexts.
3. Check `bibliography-stack` for the relevant stage before execution.
4. If work is larger than one paper or spans multiple files/outputs, use `TaskManager`.
5. Produce a staged plan using the workflow vocabulary:
   - literature pool
   - screening
   - full-text review
   - decision
   - citation audit

### `/bibliography screening`

Use for title/abstract triage.

Required context:
- `bibliography-workflow.md`
- `bibliography-paper-screening.md`

Output requirements:
- `keep`, `defer`, or `reject`
- short rationale grounded in metadata
- next action

### `/bibliography review`

Use for full-text reading and reading-card generation.

Required context:
- `bibliography-workflow.md`
- `bibliography-fulltext-review.md`

Output requirements:
- reading card
- key findings
- limitations
- misuse risks
- suggested downstream role

### `/bibliography decision`

Use to convert review notes into keep/drop/defer/revisit decisions.

Required context:
- `bibliography-workflow.md`
- `bibliography-literature-decision.md`

Output requirements:
- explicit decision state
- paper role
- evidence-backed rationale
- next action

### `/bibliography audit`

Use when writing already exists and citations must be checked.

Process:
1. Load `bibliography-workflow.md`.
2. Review the relevant draft section, note set, or evidence pack.
3. Verify each citation can be traced back to explicit evidence.
4. Flag unsupported, over-claimed, or redundant citations.

## Agent Behavior

### Context Discovery

Before doing non-trivial bibliography work:

```javascript
task(
  subagent_type="ContextScout",
  description="Find bibliography workflow context",
  prompt="Find bibliography, citation, review, and evidence-pack context files relevant to this request. Prioritize the bibliography workflow files and any project-specific writing standards."
)
```

### When to Use TaskManager

Use `TaskManager` when:
- the request covers multiple papers
- the request spans screening + review + decision
- the request needs a persistent staged plan
- the request touches 4+ files or will likely exceed 60 minutes

Task plans should break work by bibliography stage, not by arbitrary file groups.

## Output Templates

### Screening

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

### Review

```markdown
paper_id: {key}
title: {title}
method: {method}
key_findings:
- finding 1
- finding 2
limitations:
- limit 1
- limit 2
misuse_risks:
- risk 1
- risk 2
```

### Decision

```markdown
paper_id: {key}
title: {title}
decision: keep | defer | reject | revisit_later
paper_role: {core support | method support | related work | background | none}
decision_reason: {why}
next_action: {cite now | compare later | archive | monitor}
```

## Success Criteria

- Papers move through explicit stages.
- The active reading queue stays intentionally small.
- A paper is not considered done without reusable notes.
- Final writing decisions are traceable back to evidence.
