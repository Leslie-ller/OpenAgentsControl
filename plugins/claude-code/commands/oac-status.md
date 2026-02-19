---
name: oac:status
description: Show OAC plugin status, installed context, and available skills
---

Show the current OAC plugin status by running:

!ls -la .opencode/context/ 2>/dev/null && echo "Context installed" || echo "No context installed — run /install-context"
!cat .context-manifest.json 2>/dev/null | head -20 || echo "No manifest found"

Then report:
- Plugin version: 1.0.0
- Context status (installed/not installed)
- Available skills: brainstorming, context-discovery, systematic-debugging, verification-before-completion, task-breakdown, code-execution, test-generation, code-review, external-scout, parallel-execution
- Available subagents: context-scout, task-manager, coder-agent, test-engineer, code-reviewer, context-manager, external-scout
