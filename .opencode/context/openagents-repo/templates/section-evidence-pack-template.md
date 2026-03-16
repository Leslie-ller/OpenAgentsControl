<!-- Context: openagents-repo/section-evidence-pack | Priority: medium | Version: 1.0 | Updated: 2026-03-16 -->

# Section Evidence Pack Template

**Purpose**: Reusable section-level evidence pack for drafting and citation safety

---

## Template

```markdown
# Section Evidence Pack: {section name}

section: {section name}
scope: {what this section is responsible for}
claim_cluster: {main group of claims this section needs to support}

## Safe Claims

- claim 1
- claim 2
- claim 3

## Supporting Sources

- {source key} — {role} — {what it safely supports}
- {source key} — {role} — {what it safely supports}

## Claim-to-Source Mapping

- claim: {claim}
  support:
  - {source key}
  - {source key}

## Boundaries

- what this evidence pack does support
- what this evidence pack does not support

## Gaps

- gap 1
- gap 2

## Drafting Constraints

- avoid over-claiming X
- do not cite Y for Z

## Next Action

{draft section | gather missing evidence | re-check decision cards | hold}
```

---

## Rules

- Organize by claim cluster, not by bibliography order.
- Make boundaries explicit so writers know what is unsafe to say.
- If a claim cannot be safely supported, move it to `Gaps` or `Boundaries`.
