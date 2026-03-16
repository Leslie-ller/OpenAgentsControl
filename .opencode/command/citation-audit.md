---
description: Run citation audit on drafted sections using evidence packs and literature decisions
tags:
  - bibliography
  - citation-audit
  - review
  - research
dependencies:
  - subagent:contextscout
  - subagent:task-manager
  - tool:bibliography-stack
  - context:bibliography-workflow
  - context:section-evidence-pack-template
  - context:citation-audit-template
  - context:citation-audit-task-template
---

# Citation Audit Command

Use this command for the `citation_audit` stage of the bibliography workflow.

## Usage

```bash
/citation-audit {draft section, section evidence pack, or chapter excerpt}
```

## Purpose

This command is the final safety gate in the bibliography workflow. It checks whether drafted claims are actually supported by approved evidence instead of merely accompanied by citations.

Load these before planning or execution:

- `.opencode/context/core/workflows/bibliography-workflow.md`
- `.opencode/context/openagents-repo/templates/section-evidence-pack-template.md`
- `.opencode/context/openagents-repo/templates/citation-audit-template.md`
- `.opencode/context/openagents-repo/templates/citation-audit-task-template.md`

Required tooling:

- `reference_manager`

Configured through:

- `BIBLIOGRAPHY_REFERENCE_MANAGER_CMD`, `BIBLIOGRAPHY_ZOTERO_CMD`, or `ZOTERO_CMD`

## Required Outputs

For the audited section:

```markdown
section: {name}
audit_status: pass | revise | fail
supported_claims:
- claim 1
- claim 2
unsupported_or_weak_claims:
- claim 1
- claim 2
misused_citations:
- source + issue
- source + issue
next_action: {adopt | revise | gather evidence | downgrade claims}
```

## Execution Rules

1. Audit claims, not citation counts.
2. A cited paper is insufficient if the section overstates what it supports.
3. Unsupported claims must be downgraded, removed, or sent back for evidence gathering.
4. Do not proceed if reference-manager tooling is missing.
5. A section should not be considered safe just because it cites many papers.

## TaskManager Hand-off

When the request covers multiple sections or a whole chapter:

1. Call `ContextScout` for writing, bibliography, and review standards.
2. Use the citation audit template for the reusable audit artifact.
3. Use the citation audit task template for task planning.
4. Separate subtasks into:
   - inventory claims and cited sources
   - compare claims to evidence pack boundaries
   - flag weak support and misuse
   - summarize revision actions

## Success Criteria

- Every major claim is classified as supported, weak, or unsupported.
- Misused citations are explicit.
- The result is an operational gate: pass, revise, or fail.
- Revision actions are clear enough for a writer or reviewer to act on immediately.
