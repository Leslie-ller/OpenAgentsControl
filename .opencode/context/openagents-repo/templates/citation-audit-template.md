<!-- Context: openagents-repo/citation-audit | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Citation Audit Template

**Purpose**: Reusable reviewer-facing audit artifact for verifying claim-to-citation support

---

## Template

```markdown
# Citation Audit: {section name}

section: {section name}
audit_status: pass | revise | fail
evidence_pack: {linked evidence pack or identifier}

## Supported Claims

- claim 1 — supported by {source key}
- claim 2 — supported by {source key}

## Weak or Unsupported Claims

- claim 1 — {why support is weak or missing}
- claim 2 — {why support is weak or missing}

## Misused Citations

- {source key} — {how the draft stretches, misreads, or overclaims the source}
- {source key} — {how the draft stretches, misreads, or overclaims the source}

## Boundary Violations

- claim outside evidence pack boundary
- citation used for unsupported scope expansion

## Required Revisions

- revise claim X
- replace citation Y
- remove unsupported sentence Z

## Reviewer Note

{Short note explaining whether the section is safe to adopt, needs revision, or must return for evidence work}
```

---

## Rules

- Focus on evidential support, not stylistic polish.
- If support is partial, mark it as weak rather than silently accepting it.
- Use the reviewer note as a gate decision, not just commentary.
