# OpenCode Bibliography Runtime Handoff

Date: 2026-03-20

## Scope

This handoff covers the follow-up after switching bibliography agent execution back to the OpenCode runtime channel.

Relevant code already landed earlier:

- `c43bf4e` - route ability agents through opencode sessions
- `94e3edc` - guard bibliography decisions with fresh reading cards

Key files:

- `packages/plugin-abilities/src/runtime/opencode-agent-context.ts`
- `packages/plugin-abilities/src/opencode-plugin.ts`
- `packages/plugin-abilities/src/index.ts`
- `packages/plugin-abilities/tests/opencode-agent-context.test.ts`

## What Was Verified

### 1. Code and tests

Plugin-side wiring is in place:

- `ability.run` and `ability.command` now pass `sessionID` and `agent`
- executor context injects `agents` via OpenCode `ctx.client.session.create/prompt/delete`
- adapter tests passed
- bibliography regression tests remained green

### 2. Live CLI baseline

Plain OpenCode CLI works:

```bash
/home/leslie/.opencode/bin/opencode run --agent opencoder --model github-copilot/gpt-5.3-codex "Reply with exactly OK and nothing else."
```

Observed result: `OK`

Exported baseline session:

- `ses_2f624bfaeffe5F7L4SGZS9bpXQ`

### 3. Live bibliography-style invocations

#### A. Prompt instructing model to call `ability.command`

Command:

```bash
/home/leslie/.opencode/bin/opencode run --model github-copilot/gpt-5.3-codex "Use the ability.command tool exactly once to run /paper-fulltext-review with arguments {\"zotero_key\":\"BVJWFEF5\",\"collection_key\":\"NNV7TZ9J\"}. After the tool finishes, return only a one-line status summary with the selected_source if present."
```

Observed parent session:

- `ses_2f624625effeTDjeyfAiMX3rNw`

Observed behavior:

- model did **not** call `ability.command`
- model used built-in `task` tool instead
- task created child session `ses_2f6242f38ffezhBKSlfijyHvQ3`

#### B. Direct slash-command text through `opencode run`

Command:

```bash
/home/leslie/.opencode/bin/opencode run --model github-copilot/gpt-5.3-codex '/paper-fulltext-review {"zotero_key":"BVJWFEF5","collection_key":"NNV7TZ9J"}'
```

Observed parent session:

- `ses_2f622d7cdffeUrsr2fVctdkXjO`

Observed behavior:

- OpenCode again routed through built-in `task`
- task created child session `ses_2f622c0e4ffe7B3wJrS2ADp260`

### 4. Direct SDK/session API checks

Against local desktop server `http://127.0.0.1:4096`:

- `session.create()` works
- `session.prompt()` returns `undefined`
- `session.messages()` returns `undefined`
- `session.command('/paper-fulltext-review', ...)` returns `undefined`

Reproduction session for direct `session.command()`:

- `ses_2f621d886ffeDN3Doq6y52ttjH`

Export showed:

- session exists
- no messages were recorded

### 5. TLS bypass experiment

A separate isolated server was started on port `4097` with:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 /home/leslie/.opencode/bin/opencode serve --hostname 127.0.0.1 --port 4097
```

Result:

- this bypass avoids depending on the existing desktop server process
- but `session.prompt()` and `session.command()` still return `undefined`
- `session.messages()` also returns `undefined`

So the certificate issue is real noise, but it is **not sufficient** to explain the direct SDK/session-command failure.

## Runtime Findings

### Confirmed

1. Plugin-side OpenCode agent routing is implemented and tested.
2. Plain OpenCode model calls can succeed.
3. Bibliography-like invocations through `opencode run` are being intercepted by OpenCode's built-in command/task behavior before they prove plugin command execution.
4. Direct SDK `session.command()` is not currently giving usable message data in this environment.

### Still Unclear

1. Whether `session.command()` is incomplete or intentionally no-op in this local serve/runtime combination.
2. Whether command handling for slash commands under `opencode run` is expected to delegate into the built-in task/general-agent path instead of plugin command handlers.
3. Whether the desktop app's local server at `4096` has additional routing behavior that differs from standalone `serve`.

## Practical Status

The repo is in this state:

- plugin code: ready
- tests: ready
- opencode-native bibliography live proof: **not yet cleanly proven**

This is a runtime integration issue now, not a bibliography pipeline logic issue.

## Recommended Next Step

Do not continue changing bibliography workflow code yet.

Instead, investigate the OpenCode runtime/command layer with this order:

1. confirm expected semantics of `session.command()` in this OpenCode version
2. identify a direct command-handler entry that bypasses model interpretation and built-in `task` detours
3. only after that, rerun `/paper-fulltext-review` and confirm the plugin path reaches `ability.command` and then the bibliography runtime ability

## Workspace Notes

This handoff intentionally avoids touching unrelated dirty worktree items:

- `context-findings/plan/coding-workflow-control-plan.md`
- `packages/plugin-abilities/tests/context-checkpoint-mvp.test.ts`
- local bibliography data/run artifacts under `.opencode/`
