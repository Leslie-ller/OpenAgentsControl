---
description: Build section evidence packs from reviewed and decided literature assets
tags:
  - bibliography
  - evidence-pack
  - writing
  - research
dependencies:
  - subagent:contextscout
  - subagent:task-manager
  - tool:bibliography-stack
  - context:bibliography-workflow
  - context:bibliography-reading-card-template
  - context:bibliography-decision-card-template
  - context:section-evidence-pack-template
  - context:section-evidence-pack-task-template
---

# Section Evidence Pack Command

Use this command to build a `section_evidence_pack` from reading cards and literature decisions.

## Usage

```bash
/section-evidence-pack {section, claim cluster, or chapter topic}
```

Runtime ability: `research/section-evidence-pack`

## Purpose

This command bridges bibliography work into writing-safe evidence organization. It turns paper-level assets into section-level support that drafting and citation audit can trust.

Load these before planning or execution:

- `.opencode/context/core/workflows/bibliography-workflow.md`
- `.opencode/context/openagents-repo/templates/bibliography-reading-card-template.md`
- `.opencode/context/openagents-repo/templates/bibliography-decision-card-template.md`
- `.opencode/context/openagents-repo/templates/section-evidence-pack-template.md`
- `.opencode/context/openagents-repo/templates/section-evidence-pack-task-template.md`

## Required Outputs

For the section:

```markdown
section: {name}
claim_cluster: {what the section needs to prove}
safe_claims:
- claim 1
- claim 2
supporting_sources:
- source + role
- source + role
gaps:
- gap 1
- gap 2
next_action: {draft | gather more evidence | downgrade claim}
```

## Execution Rules

1. Build packs around section claims, not around paper titles.
2. Only include claims that are supportable from reading cards or decision cards.
3. If evidence is weak, downgrade the claim instead of stretching the citation.
4. Evidence packs should make drafting easier and citation audit stricter.

## TaskManager Hand-off

When the request covers multiple sections or a broad chapter:

1. Call `ContextScout` for writing, bibliography, and citation standards.
2. Use the section evidence pack template for the reusable artifact.
3. Use the section evidence pack task template for task planning.
4. Separate subtasks into:
   - define section claim cluster
   - collect eligible reading/decision cards
   - assemble safe claims and source mapping
   - summarize evidence gaps and drafting constraints

## Success Criteria

- Claims are grouped by section need, not by paper inventory.
- Every included claim has supporting sources.
- Gaps and unsafe claims are explicit.
- The output is ready for drafting or citation audit hand-off.
