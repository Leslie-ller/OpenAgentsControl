<!-- Context: workflows/bibliography | Priority: high | Version: 1.1 | Updated: 2026-03-16 -->

# Bibliography Workflow

## Quick Reference

**Purpose**: Move papers from candidate collection to evidence-backed writing decisions

**Stages**: Literature Pool -> Paper Screening -> Full-Text Review -> Literature Decision -> Citation Audit

**When to Use**: Thesis paper triage, evidence-pack preparation, reading queue management, reference curation

**Key Tools**: ContextScout, ExternalScout, local bibliography tools such as Zotero, PDF extraction tooling, reading-card notes, evidence packs

---

## Overview

This workflow is adapted from an existing AgentOS paper-management pattern rather than invented from scratch. The core idea is simple:

1. Do not treat the bibliography as a flat pile.
2. Keep the active reading queue small.
3. A paper is not "read" until it has a reusable reading card or equivalent evidence note.
4. Drafting should depend on evidence packs, not on vague memory of the literature pool.

OpenAgents Control should therefore model bibliography work as a staged workflow with explicit transitions and outputs.

---

## Stage Map

| Stage | Goal | Primary Output | Common Failure |
|------|------|----------------|----------------|
| `literature_pool` | Maintain a candidate collection | Searchable candidate set | Dumping papers without triage |
| `paper_screening` | Fast title/abstract triage | Candidate status + reason | Criteria drift or vague inclusion logic |
| `paper_fulltext_review` | Read shortlisted papers deeply | Reading card / evidence notes | Notes not tied to claims or limits |
| `literature_decision` | Decide paper role in the project | Keep / defer / reject / role assignment | Decision made without explicit evidence |
| `citation_audit` | Verify what enters writing | Audited citation-ready set | Drafting from memory instead of evidence |

---

## Five-Layer Model

The workflow works best when treated as five layers:

1. **Literature Pool**
   The complete candidate set, typically in a bibliography manager or collection.

2. **Active Reading Queue**
   A deliberately small subset currently under review.

3. **Paper Reading Card**
   Structured notes for one paper: problem, method, findings, limits, reuse value.

4. **Section Evidence Pack**
   Cross-paper evidence organized around a writing section or claim.

5. **Citation Audit**
   Final check that citations in the draft are supported by evidence packs and correctly scoped.

---

## Core Rules

1. **Do not let the active reading queue grow without bound.**
2. **Every paper that survives full-text review must produce reusable notes.**
3. **Every decision needs evidence**, not just intuition.
4. **Prefer staged narrowing** over collecting everything first and deciding later.
5. **Draft from evidence packs**, not directly from the whole literature pool.
6. **Record uncertainty explicitly** as `defer` or `revisit_later`.

---

## Minimal Output Contract

Use this shape across the decision-bearing stages:

```markdown
paper_id: {stable id or citation key}
title: {paper title}
status: {screening result, review state, or final decision}
role: {core support | method support | related work | background | reject}
reason: {1-3 sentence explanation}
evidence:
- {claim or excerpt summary}
- {claim or excerpt summary}
next_action: {what happens next}
```

---

## Recommended Execution Order

1. Load this file for the overall staged model.
2. Load `bibliography-paper-screening.md` for candidate triage.
3. Load `bibliography-fulltext-review.md` for reading-card generation.
4. Load `bibliography-literature-decision.md` for keep/drop/role decisions.
5. If bibliography tools or PDF extraction are involved, also load `external-context-management.md`.

---

## Integration Notes

- **TaskManager** should break bibliography work by stage, not by arbitrary file batches.
- **ContextScout** should locate citation standards, reading-note formats, and evidence-pack patterns before planning.
- **ExternalScout** is useful when Zotero docs, publisher APIs, or PDF extraction libraries are involved.
- **Reviewer** should check that writing decisions are traceable back to explicit paper evidence.
- If a project uses Zotero, treat Zotero as the literature pool rather than the final source of truth for writing claims.

---

## Exit Criteria

- The candidate pool has been narrowed deliberately.
- The active reading queue remains small and explicit.
- Reviewed papers have evidence-backed reading cards.
- Final literature decisions are auditable and reversible.
- Citation-ready claims can be traced back to section-level evidence.
