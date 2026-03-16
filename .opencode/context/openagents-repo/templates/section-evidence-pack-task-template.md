<!-- Context: openagents-repo/section-evidence-pack-task | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Section Evidence Pack Task Template

**Purpose**: Reusable TaskManager template for building section evidence packs

**Location**: `.tmp/tasks/{feature-slug}/task.json` and `subtask_XX.json`

---

## Recommended Feature Slug

`section-evidence-pack-mvp`

---

## task.json Template

```json
{
  "id": "section-evidence-pack-mvp",
  "name": "Section Evidence Pack MVP",
  "status": "active",
  "objective": "Convert reading cards and literature decisions into a section-level evidence pack for safe drafting.",
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/task-management/standards/task-schema.md",
    ".opencode/context/openagents-repo/templates/section-evidence-pack-template.md"
  ],
  "reference_files": [
    "{reading-cards-and-decision-cards}"
  ],
  "exit_criteria": [
    "Section claim cluster is explicit",
    "Every safe claim has supporting sources",
    "Gaps and boundaries are documented",
    "Output is usable by drafting or audit work"
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
  "id": "section-evidence-pack-mvp-01",
  "seq": "01",
  "title": "Define section scope and claim cluster",
  "status": "pending",
  "depends_on": [],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md"
  ],
  "reference_files": [
    "{section-brief-or-outline}"
  ],
  "acceptance_criteria": [
    "Section scope is explicit",
    "Claim cluster is narrow enough to validate"
  ],
  "deliverables": [
    "section scope note",
    "claim cluster note"
  ]
}
```

## subtask_02.json Template

```json
{
  "id": "section-evidence-pack-mvp-02",
  "seq": "02",
  "title": "Collect eligible reading and decision cards",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md"
  ],
  "reference_files": [
    "{reading-cards-and-decision-cards}"
  ],
  "acceptance_criteria": [
    "Only relevant sources are included",
    "Included sources have explicit roles"
  ],
  "deliverables": [
    "eligible source set"
  ]
}
```

## subtask_03.json Template

```json
{
  "id": "section-evidence-pack-mvp-03",
  "seq": "03",
  "title": "Assemble safe claims and source mappings",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": false,
  "context_files": [
    ".opencode/context/openagents-repo/templates/section-evidence-pack-template.md"
  ],
  "reference_files": [
    "{eligible-source-set}"
  ],
  "acceptance_criteria": [
    "Each safe claim has supporting sources",
    "Boundaries are explicit"
  ],
  "deliverables": [
    "section evidence pack"
  ]
}
```

## subtask_04.json Template

```json
{
  "id": "section-evidence-pack-mvp-04",
  "seq": "04",
  "title": "Summarize gaps and drafting constraints",
  "status": "pending",
  "depends_on": ["03"],
  "parallel": true,
  "context_files": [
    ".opencode/context/openagents-repo/templates/section-evidence-pack-template.md"
  ],
  "reference_files": [
    "{section-evidence-pack}"
  ],
  "acceptance_criteria": [
    "Unsafe claims are separated from safe claims",
    "Next action is explicit"
  ],
  "deliverables": [
    "gap summary",
    "drafting constraint note"
  ]
}
```

---

## Notes

- Use reading cards and decision cards as source inputs, not raw bibliography dumps.
- Section evidence packs should be the immediate input to drafting.
- Citation audit can follow later as a stricter validation pass.
