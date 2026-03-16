<!-- Context: openagents-repo/bibliography-decision-card | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Bibliography Decision Card Template

**Purpose**: Reusable decision-card format for literature keep/defer/reject judgments

---

## Template

```markdown
# Literature Decision Card: {paper title or cluster}

paper_id: {citation key or cluster id}
title: {paper title or cluster title}
decision: keep | defer | reject | revisit_later
paper_role: {core support | method support | related work | background | none}

## Decision Reason

{1-3 sentence explanation of why this state and role were chosen}

## Decision Evidence

- evidence point 1
- evidence point 2
- evidence point 3

## Tradeoffs

- gain 1
- loss 1

## Redundancy Check

{Is this paper stronger, weaker, or redundant relative to already-kept sources?}

## Revisit Condition

{If deferred or revisit_later, what would trigger another review?}

## Next Action

{cite now | fold into evidence pack | compare with stronger source | archive | monitor}
```

---

## Rules

- Keep the role narrow and operational.
- Decision reasons should be evidence-backed, not preference-backed.
- Use the revisit field even when the answer is “not applicable”.
