<!-- Context: openagents-repo/bibliography-screening-template | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Bibliography Paper Screening Task Template

**Purpose**: Reusable TaskManager template for the `paper_screening` stage of bibliography workflows

**Location**: `.tmp/tasks/{feature-slug}/task.json` and `subtask_XX.json`

---

## Recommended Feature Slug

`paper-screening-mvp`

---

## task.json Template

```json
{
  "id": "paper-screening-mvp",
  "name": "Paper Screening MVP",
  "status": "active",
  "objective": "Triage a candidate paper set into a small active reading queue with explicit keep/defer/reject criteria.",
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/workflows/bibliography-paper-screening.md",
    ".opencode/context/core/task-management/standards/task-schema.md"
  ],
  "reference_files": [
    "{candidate-list-or-query-source}"
  ],
  "exit_criteria": [
    "Screening criteria written down before batch triage",
    "Each candidate has keep, defer, or reject status",
    "Kept papers fit within an explicit active queue limit",
    "Deferred and rejected papers include short reasons"
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
  "id": "paper-screening-mvp-01",
  "seq": "01",
  "title": "Define screening criteria and queue limit",
  "status": "pending",
  "depends_on": [],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/workflows/bibliography-paper-screening.md"
  ],
  "reference_files": [
    "{research-question-or-topic-brief}"
  ],
  "acceptance_criteria": [
    "Criteria are explicit enough to reuse across the whole batch",
    "Queue size limit is stated"
  ],
  "deliverables": [
    "screening criteria note",
    "queue size rule"
  ]
}
```

## subtask_02.json Template

```json
{
  "id": "paper-screening-mvp-02",
  "seq": "02",
  "title": "Triage candidate papers using metadata",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-paper-screening.md"
  ],
  "reference_files": [
    "{candidate-list-or-query-source}"
  ],
  "acceptance_criteria": [
    "Each candidate has keep, defer, or reject status",
    "Reasons are grounded in visible metadata"
  ],
  "deliverables": [
    "screened candidate list"
  ]
}
```

## subtask_03.json Template

```json
{
  "id": "paper-screening-mvp-03",
  "seq": "03",
  "title": "Build the active reading queue",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/workflows/bibliography-paper-screening.md"
  ],
  "reference_files": [
    "{screened-candidate-list}"
  ],
  "acceptance_criteria": [
    "Queue contains only the highest-value kept papers",
    "Queue size does not exceed the stated limit"
  ],
  "deliverables": [
    "active reading queue"
  ]
}
```

## subtask_04.json Template

```json
{
  "id": "paper-screening-mvp-04",
  "seq": "04",
  "title": "Summarize deferred and rejected items",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": true,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-paper-screening.md"
  ],
  "reference_files": [
    "{screened-candidate-list}"
  ],
  "acceptance_criteria": [
    "Deferred items include re-check conditions",
    "Rejected items remain auditable"
  ],
  "deliverables": [
    "deferred/rejected summary"
  ]
}
```

---

## Notes

- Keep `context_files` limited to standards and workflow rules.
- Put candidate CSVs, queries, note files, or collection exports in `reference_files`.
- If screening spans multiple collections, create a larger parent task and reuse these subtasks per batch.
