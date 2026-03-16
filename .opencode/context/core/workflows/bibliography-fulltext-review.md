<!-- Context: workflows/bibliography-fulltext | Priority: high | Version: 1.1 | Updated: 2026-03-16 -->

# Bibliography Workflow: Full-Text Review

## Quick Reference

**Goal**: Turn a queued paper into a reusable reading card and evidence note

**Inputs**: Full PDF or stable text source, screening result, research question

**Outputs**: Reading card, structured evidence notes, known limitations, suggested paper role

---

## Review Process

1. **Confirm Fit**
   Re-check that the full paper still matches why it survived screening.

2. **Extract Core Claims**
   Capture the paper's main argument, method, findings, and limitations.

3. **Link Evidence to Sections**
   Notes should point to page numbers, headings, figures, or tables whenever possible.

4. **Record Reuse Value**
   State whether the paper supports background framing, method choice, empirical evidence, contradiction handling, or only peripheral awareness.

5. **Record Misuse Risk**
   Note where the paper could be over-claimed, mis-cited, or mistaken for a stronger source than it really is.

---

## Minimum Reading Card

```markdown
paper_id: {citation key}
title: {paper title}
research_problem: {what problem the paper addresses}
method: {study design / system / data approach}
key_findings:
- finding 1
- finding 2
limitations:
- limitation 1
- limitation 2
use_for_current_work:
- background
- method
- evidence
misuse_risks:
- risk 1
- risk 2
```

---

## Review Rules

- Prefer paraphrased evidence with location markers over long copied text.
- Separate the author's claim from your interpretation.
- If evidence is weak or contradictory, mark it explicitly.
- If full text undermines the screening decision, send it to `literature_decision` with that note.
- A paper is not considered truly reviewed until its reading card is reusable by someone else.

---

## Exit Criteria

- A future teammate can understand why this paper matters without reopening it immediately.
- Findings and limitations are both captured.
- Evidence is specific enough to support downstream keep/drop decisions.
- Misuse risks are explicit enough to prevent bad citations later.
