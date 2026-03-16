---
description: Run the paper full-text review stage for bibliography workflows
tags:
  - bibliography
  - fulltext
  - review
  - research
dependencies:
  - subagent:contextscout
  - subagent:task-manager
  - tool:bibliography-stack
  - context:bibliography-workflow
  - context:bibliography-fulltext-review
  - context:bibliography-reading-card-template
  - context:bibliography-fulltext-review-task-template
---

# Paper Full-Text Review Command

Use this command for the `paper_fulltext_review` stage of the bibliography workflow.

## Usage

```bash
/paper-fulltext-review {paper key, shortlist, or reading queue}
```

## Purpose

This is the focused execution entrypoint for the `AGE-31` line: turn screened papers into reusable reading cards and evidence notes.

Load these before planning or execution:

- `.opencode/context/core/workflows/bibliography-workflow.md`
- `.opencode/context/core/workflows/bibliography-fulltext-review.md`
- `.opencode/context/openagents-repo/templates/bibliography-reading-card-template.md`
- `.opencode/context/openagents-repo/templates/bibliography-fulltext-review-task-template.md`

Required tooling:

- `pdf_extract`
- `reference_manager`

Configured through:

- `BIBLIOGRAPHY_PDF_EXTRACT_CMD`, `BIBLIOGRAPHY_PDF_CMD`, or `MINERU_CMD`
- `BIBLIOGRAPHY_REFERENCE_MANAGER_CMD`, `BIBLIOGRAPHY_ZOTERO_CMD`, or `ZOTERO_CMD`

## Required Outputs

For each paper:

```markdown
paper_id: {key}
title: {title}
research_problem: {problem}
method: {method}
key_findings:
- finding 1
- finding 2
limitations:
- limitation 1
- limitation 2
misuse_risks:
- risk 1
- risk 2
suggested_role: {core support | method support | related work | background}
```

For the batch:

- reviewed paper count
- reading card list
- evidence gaps
- hand-off recommendation for `literature_decision`

## Execution Rules

1. Review means full-text evidence extraction, not just abstract paraphrase.
2. A paper is not considered reviewed until its reading card is reusable by another teammate.
3. Findings and limitations must both be captured.
4. Do not proceed if PDF extraction or reference-manager tooling is missing.
5. If the paper collapses under full-text review, send that signal forward to `literature_decision`.

## TaskManager Hand-off

When the request covers multiple papers or needs persistent tracking:

1. Call `ContextScout` for bibliography, citation, and writing standards.
2. Use the reading card template for per-paper outputs.
3. Use the full-text review task template for task planning.
4. Separate subtasks into:
   - confirm queue and source files
   - extract paper evidence
   - write reading cards
   - summarize evidence gaps and next actions

## Success Criteria

- Every reviewed paper has a reusable reading card.
- Evidence is tied to explicit findings and limits.
- Misuse risks are documented.
- The next decision step is clear.
