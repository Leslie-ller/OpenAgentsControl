# Thesis Bibliography Materials Agent Index

Date: 2026-03-20

## Purpose

This note tells other agents where the graduation-thesis bibliography materials already exist in the repo, which artifacts are safe to use directly for writing, and which sources must be treated as peripheral only.

## Scope

Collection:

- Zotero collection key `NNV7TZ9J`

Current status:

- screening: 20/20
- reading-card: 20/20
- decision: 20/20
- writing packs cleaned for direct use on 2026-03-20

Related cleanup commit:

- `41dcb49` - `docs: clean thesis bibliography evidence packs`

## Where The Materials Are

Primary artifact directories:

- `.opencode/bibliography-data/reading-card/`
- `.opencode/bibliography-data/decision/`
- `.opencode/bibliography-data/evidence-pack/`
- `.opencode/bibliography-data/audit/`
- `.opencode/bibliography-runs/`

Most useful direct-writing packs:

- `.opencode/bibliography-data/evidence-pack/integrated-optimization.json`
- `.opencode/bibliography-data/evidence-pack/methods.json`
- `.opencode/bibliography-data/evidence-pack/advanced-methods.json`
- `.opencode/bibliography-data/evidence-pack/thesis-positioning.json`
- `.opencode/bibliography-data/evidence-pack/discussion.json`

Audit companions:

- `.opencode/bibliography-data/audit/integrated-optimization.json`
- `.opencode/bibliography-data/audit/methods.json`
- `.opencode/bibliography-data/audit/advanced-methods.json`
- `.opencode/bibliography-data/audit/thesis-positioning.json`
- `.opencode/bibliography-data/audit/discussion.json`

Runtime and provenance handoff:

- `context-findings/opencode-bibliography-runtime-handoff-2026-03-20.md`

## Safe To Use Directly

The package is now good enough to use as a thesis-writing working set.

Use these as the main anchors:

- `N2NZU362` / `SXA2P46H` for integrated supply-chain optimization and integrated-vs-sequential framing
- `QMCNK2IN` for ML-for-CO methodological framing
- `GFAX4VBM` for ML-augmented MILP solver-side acceleration background
- `F4UBRWXW` for mixed-integer optimization with learned constraints
- `MWPFTLUA` for GA-plus-MILP matheuristic relevance
- `BVJWFEF5` for iterative prediction-and-optimization with optimization backbone
- `EYYET7D2` for MILP-first integrated optimization with learning-assisted tractability support

Important manual improvement already applied:

- `.opencode/bibliography-data/reading-card/sxa2p46h.json` was manually upgraded after the initial lightweight-model run and is considered usable for thesis writing.

## Peripheral Only

These sources exist in the repo but must not be used as core thesis evidence:

- `7SU3JVXE`
  - reason: abstract-level evidence only, high uncertainty
  - acceptable use: peripheral warm-start example only
- `GYBGITS8`
  - reason: cross-domain unit-commitment source plus title/DOI-level evidence only
  - acceptable use: transferable MILP technique reference only

These weak sources were removed from the cleaned direct-writing packs in commit `41dcb49`.

## Agent Guidance

When another agent needs bibliography context, use this order:

1. Start from the relevant `evidence-pack/*.json` file for the section being written.
2. Check the paired `audit/*.json` file only as a coverage companion, not as a substitute for quality judgment.
3. Open the specific `reading-card/*.json` files for any paper that will support a core claim.
4. Do not promote `7SU3JVXE` or `GYBGITS8` into methods, thesis-positioning, or core discussion claims.
5. If a claim depends on runtime provenance or OpenCode execution path details, also read `context-findings/opencode-bibliography-runtime-handoff-2026-03-20.md`.

## Important Caveat

`audit` pass means the selected claims were grounded against included artifacts. It does not mean every included paper is equally strong. The cleaned packs are safer than before, but agents should still prefer the strongest integrated-optimization and methodology anchors for thesis-core writing.
