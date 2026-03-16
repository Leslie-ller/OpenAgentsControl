<!-- Context: openagents-repo/bibliography-fulltext-template | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Bibliography Full-Text Review Task Template

**Purpose**: Reusable TaskManager template for the `paper_fulltext_review` stage of bibliography workflows

**Location**: `.tmp/tasks/{feature-slug}/task.json` and `subtask_XX.json`

---

## Recommended Feature Slug

`paper-fulltext-review-mvp`

---

## task.json Template

```json
{
  "id": "paper-fulltext-review-mvp",
  "name": "Paper Full-Text Review MVP",
  "status": "active",
  "objective": "Turn a screened paper queue into reusable reading cards and evidence notes.",
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/workflows/bibliography-fulltext-review.md",
    ".opencode/context/core/task-management/standards/task-schema.md",
    ".opencode/context/openagents-repo/templates/bibliography-reading-card-template.md"
  ],
  "reference_files": [
    "{paper-queue-or-source-list}"
  ],
  "exit_criteria": [
    "Each reviewed paper has a reading card",
    "Findings and limitations are both captured",
    "Misuse risks are explicit",
    "Next decision step is stated"
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
  "id": "paper-fulltext-review-mvp-01",
  "seq": "01",
  "title": "Confirm review queue and source availability",
  "status": "pending",
  "depends_on": [],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/workflows/bibliography-fulltext-review.md"
  ],
  "reference_files": [
    "{paper-queue-or-source-list}"
  ],
  "acceptance_criteria": [
    "Review queue is explicit",
    "Full-text sources are available or missing items are flagged"
  ],
  "deliverables": [
    "review queue confirmation",
    "source availability note"
  ]
}
```

## subtask_02.json Template

```json
{
  "id": "paper-fulltext-review-mvp-02",
  "seq": "02",
  "title": "Extract full-text evidence from queued papers",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-fulltext-review.md"
  ],
  "reference_files": [
    "{paper-fulltext-sources}"
  ],
  "acceptance_criteria": [
    "Key findings are evidence-based",
    "Limitations are captured from the full text"
  ],
  "deliverables": [
    "paper evidence notes"
  ]
}
```

## subtask_03.json Template

```json
{
  "id": "paper-fulltext-review-mvp-03",
  "seq": "03",
  "title": "Write reusable reading cards",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-fulltext-review.md",
    ".opencode/context/openagents-repo/templates/bibliography-reading-card-template.md"
  ],
  "reference_files": [
    "{paper-evidence-notes}"
  ],
  "acceptance_criteria": [
    "Each reviewed paper has a reading card",
    "Reading cards are understandable without reopening the paper immediately"
  ],
  "deliverables": [
    "reading cards"
  ]
}
```

## subtask_04.json Template

```json
{
  "id": "paper-fulltext-review-mvp-04",
  "seq": "04",
  "title": "Summarize gaps, misuse risks, and next actions",
  "status": "pending",
  "depends_on": ["03"],
  "parallel": true,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-fulltext-review.md"
  ],
  "reference_files": [
    "{reading-cards}"
  ],
  "acceptance_criteria": [
    "Misuse risks are explicit",
    "Each paper has a next action into literature decision"
  ],
  "deliverables": [
    "review summary",
    "decision hand-off note"
  ]
}
```

---

## Notes

- Use the reading card template for the per-paper artifact.
- Put PDFs, extracted text, or queue notes in `reference_files`.
- Keep review and decision separate even when they happen in the same session.
