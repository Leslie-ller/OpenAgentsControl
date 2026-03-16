<!-- Context: openagents-repo/citation-audit-task | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Citation Audit Task Template

**Purpose**: Reusable TaskManager template for citation-audit work

**Location**: `.tmp/tasks/{feature-slug}/task.json` and `subtask_XX.json`

---

## Recommended Feature Slug

`citation-audit-mvp`

---

## task.json Template

```json
{
  "id": "citation-audit-mvp",
  "name": "Citation Audit MVP",
  "status": "active",
  "objective": "Audit a drafted section against its evidence pack and cited sources to determine whether the section is safe to adopt.",
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md",
    ".opencode/context/core/task-management/standards/task-schema.md",
    ".opencode/context/openagents-repo/templates/citation-audit-template.md"
  ],
  "reference_files": [
    "{draft-section-and-evidence-pack}"
  ],
  "exit_criteria": [
    "Major claims are classified as supported, weak, or unsupported",
    "Misused citations are explicit",
    "Audit ends with pass, revise, or fail",
    "Revision actions are actionable"
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
  "id": "citation-audit-mvp-01",
  "seq": "01",
  "title": "Inventory claims and cited sources",
  "status": "pending",
  "depends_on": [],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/workflows/bibliography-workflow.md"
  ],
  "reference_files": [
    "{draft-section-and-evidence-pack}"
  ],
  "acceptance_criteria": [
    "Major claims are listed explicitly",
    "Cited sources are mapped to claims"
  ],
  "deliverables": [
    "claim and citation inventory"
  ]
}
```

## subtask_02.json Template

```json
{
  "id": "citation-audit-mvp-02",
  "seq": "02",
  "title": "Check claims against evidence pack boundaries",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    ".opencode/context/openagents-repo/templates/section-evidence-pack-template.md"
  ],
  "reference_files": [
    "{claim-and-citation-inventory}"
  ],
  "acceptance_criteria": [
    "Supported and unsupported claims are separated",
    "Boundary violations are explicit"
  ],
  "deliverables": [
    "support classification"
  ]
}
```

## subtask_03.json Template

```json
{
  "id": "citation-audit-mvp-03",
  "seq": "03",
  "title": "Write the citation audit report",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": false,
  "context_files": [
    ".opencode/context/openagents-repo/templates/citation-audit-template.md"
  ],
  "reference_files": [
    "{support-classification}"
  ],
  "acceptance_criteria": [
    "Misused citations are explicit",
    "Audit result is pass, revise, or fail"
  ],
  "deliverables": [
    "citation audit report"
  ]
}
```

## subtask_04.json Template

```json
{
  "id": "citation-audit-mvp-04",
  "seq": "04",
  "title": "Summarize revision actions and gate decision",
  "status": "pending",
  "depends_on": ["03"],
  "parallel": true,
  "context_files": [
    ".opencode/context/openagents-repo/templates/citation-audit-template.md"
  ],
  "reference_files": [
    "{citation-audit-report}"
  ],
  "acceptance_criteria": [
    "Required revisions are actionable",
    "Reviewer note gives a clear gate decision"
  ],
  "deliverables": [
    "revision action list",
    "reviewer gate note"
  ]
}
```

---

## Notes

- Audit from the evidence pack outward, not from the draft's confidence level.
- Citation audit is the final validation layer before adoption.
- If a section fails audit, route it back to evidence gathering or revision rather than silently weakening standards.
