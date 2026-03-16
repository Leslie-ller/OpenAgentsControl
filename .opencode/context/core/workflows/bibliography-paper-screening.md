<!-- Context: workflows/bibliography-screening | Priority: high | Version: 1.1 | Updated: 2026-03-16 -->

# Bibliography Workflow: Paper Screening

## Quick Reference

**Goal**: Filter a candidate pool down to a small active reading queue

**Inputs**: Title, abstract, venue, year, authors, keywords, citation metadata

**Outputs**: `keep`, `defer`, or `reject` plus a short reason and next action

---

## When to Use

Use this stage when:

- You have more candidate papers than you can read fully
- You need transparent inclusion/exclusion logic
- You are preparing a reading queue for deeper review

Do not use this stage as a substitute for full analysis. Screening is triage, not final synthesis.

The outcome of this stage should be a **small queue**, not a second large holding area.

---

## Screening Checklist

1. **Relevance**: Does the title/abstract actually match the research question?
2. **Scope Fit**: Is the paper in the right domain, method, population, or system boundary?
3. **Signal Quality**: Does the metadata suggest credible value: venue, recency, citations, or direct conceptual fit?
4. **Availability**: Can the full text be obtained without excessive friction?
5. **Role Potential**: Is it plausible that this paper could become core support, method support, or related work?

---

## Decision Rules

### `keep`

Use when the abstract strongly fits the question and there is a clear reason to spend queue capacity on it.

### `defer`

Use when fit is plausible but unclear. Common reasons:

- abstract is too vague
- methodology is not obvious
- full text is not yet available

### `reject`

Use when the paper is clearly out of scope or low-signal for the current question.

---

## Output Template

```markdown
paper_id: {citation key}
title: {paper title}
screening_status: keep | defer | reject
screening_reason: {1-3 sentence rationale}
screening_evidence:
- title/abstract cue 1
- title/abstract cue 2
next_action: {add to active reading queue | hold for later | archive}
```

---

## Quality Bar

- Reasons must refer to visible metadata, not gut feeling.
- Criteria should be reused across papers in the same batch.
- `defer` is preferred over inconsistent screening.
- If criteria drift mid-batch, stop and rewrite them before continuing.
- A `keep` result should consume queue capacity intentionally, not automatically.
