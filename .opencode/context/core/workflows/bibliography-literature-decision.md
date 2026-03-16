<!-- Context: workflows/bibliography-decision | Priority: high | Version: 1.1 | Updated: 2026-03-16 -->

# Bibliography Workflow: Literature Decision

## Quick Reference

**Goal**: Convert screening and review evidence into a writing-relevant action

**Inputs**: Screening result, full-text review notes, current research needs

**Outputs**: `keep`, `defer`, `reject`, or `revisit_later` with explicit rationale and paper role

---

## Decision Questions

1. Does this paper materially support the current argument, design, or evidence pack?
2. Is the evidence strong enough to cite or rely on?
3. Is this paper redundant with stronger sources already kept?
4. Should it remain active now, or only be revisited if a gap appears later?
5. If kept, what role should it play: core support, method support, related work, or background only?

---

## Decision States

### `keep`

The paper has clear downstream value and should remain in the active bibliography or evidence pack.

### `defer`

The paper is promising but still blocked by uncertainty, missing comparison, or incomplete extraction.

### `reject`

The paper should leave the active set because it is out of scope, weak, or redundant.

### `revisit_later`

The paper is not active now but may matter if the research direction shifts.

---

## Output Template

```markdown
paper_id: {citation key}
title: {paper title}
decision: keep | defer | reject | revisit_later
paper_role: {core support | method support | related work | background | none}
decision_reason: {1-3 sentence rationale}
decision_evidence:
- supporting point 1
- supporting point 2
tradeoffs:
- what is gained
- what is lost
next_action: {cite now | wait for comparison | archive | monitor}
```

---

## Reviewer Checklist

- Is the decision traceable back to earlier evidence?
- Is redundancy handled explicitly?
- Are weak papers rejected for a reason, not just ignored?
- Is the next action operational rather than vague?
- If the paper is kept, is its role narrow enough to avoid later over-citation?

---

## Exit Criteria

- Every active paper has an explicit decision state.
- The rationale is short but auditable.
- Deferred papers have a condition for re-checking.
- Kept papers have an explicit role in the writing system.
