<!-- Context: openagents-repo/bibliography-decision-template | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Bibliography Literature Decision Task Template

**Purpose**: Reusable TaskManager template for the `literature_decision` stage of bibliography workflows

**Location**: `.tmp/tasks/{feature-slug}/task.json` and `subtask_XX.json`

---

## Recommended Feature Slug

`literature-decision-mvp`

---

## task.json Template

```json
{
  "id": "literature-decision-mvp",
  "name": "Literature Decision MVP",
  "status": "active",
  "objective": "Convert screened and reviewed papers into explicit writing-relevant keep/defer/reject decisions.",
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/workflows/bibliography-literature-decision.md",
    ".opencode/context/core/task-management/standards/task-schema.md",
    ".opencode/context/openagents-repo/templates/bibliography-decision-card-template.md"
  ],
  "reference_files": [
    "{reading-cards-or-evidence-inputs}"
  ],
  "exit_criteria": [
    "Each active paper has a decision state",
    "Kept papers have explicit roles",
    "Deferred papers have revisit conditions",
    "Next actions are usable by downstream writing or audit work"
  ],
  "subtask_count": 4,
  "completed_count": 0,
  "created_at": "{ISO-8601 timestamp}"
}
```

---

## subtask_01.json Template

```json
{
  "id": "literature-decision-mvp-01",
  "seq": "01",
  "title": "Review evidence inputs and comparison set",
  "status": "pending",
  "depends_on": [],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/workflows/bibliography-literature-decision.md"
  ],
  "reference_files": [
    "{reading-cards-or-evidence-inputs}"
  ],
  "acceptance_criteria": [
    "Decision inputs are explicit",
    "Comparison set is clear enough to judge redundancy"
  ],
  "deliverables": [
    "decision input inventory"
  ]
}
```

## subtask_02.json Template

```json
{
  "id": "literature-decision-mvp-02",
  "seq": "02",
  "title": "Assign decision states and paper roles",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-literature-decision.md"
  ],
  "reference_files": [
    "{decision-input-inventory}"
  ],
  "acceptance_criteria": [
    "Each paper has keep, defer, reject, or revisit_later state",
    "Kept papers have narrow roles"
  ],
  "deliverables": [
    "decision matrix"
  ]
}
```

## subtask_03.json Template

```json
{
  "id": "literature-decision-mvp-03",
  "seq": "03",
  "title": "Write reusable decision cards",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-literature-decision.md",
    ".opencode/context/openagents-repo/templates/bibliography-decision-card-template.md"
  ],
  "reference_files": [
    "{decision-matrix}"
  ],
  "acceptance_criteria": [
    "Decision cards are auditable",
    "Reasons and tradeoffs are explicit"
  ],
  "deliverables": [
    "decision cards"
  ]
}
```

## subtask_04.json Template

```json
{
  "id": "literature-decision-mvp-04",
  "seq": "04",
  "title": "Summarize carry-forward actions for evidence pack or audit",
  "status": "pending",
  "depends_on": ["03"],
  "parallel": true,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-literature-decision.md"
  ],
  "reference_files": [
    "{decision-cards}"
  ],
  "acceptance_criteria": [
    "Keep/defer/reject counts are summarized",
    "Downstream next actions are explicit"
  ],
  "deliverables": [
    "decision summary",
    "evidence-pack or audit hand-off note"
  ]
}
```

---

## Notes

- Use the decision card template for the reusable artifact.
- Put reading cards, comparison notes, or evidence packs in `reference_files`.
- Do not merge decision and citation audit unless the task is explicitly audit-focused.
