# OpenCode Runtime Notes

This directory contains repo-managed OpenCode runtime plugins used by the local OpenCode installation.

## Copilot Question Proxy

Active plugin:

- `copilot-question-proxy.js`

The local OpenCode config points to the repo-managed plugin file instead of the old unmanaged copy under `~/.config/opencode/plugins/`.

## Copilot Tool Naming

For GitHub Copilot sessions, OpenCode tool names must match `^[a-zA-Z0-9_-]+$`.

Because of that, the OpenCode runtime entry for `plugin-abilities` exposes underscore-safe tool names:

- `ability_list`
- `ability_run`
- `ability_command`
- `ability_bibliography_scan`
- `ability_status`
- `ability_context_detail`
- `ability_coding_artifacts`
- `ability_cancel`

These map to the same underlying runtime behaviors as the dotted internal names used in repository docs and code, such as `ability.run` and `ability.status`.

## Reporting Path

In Copilot sessions, post-workflow reporting should go through `question_proxy`, not direct assistant text.

## Planner Handoff Mode

Default handoff mode for this workspace:

- The assistant prepares the plan.
- The assistant dispatches the plan to the workflow runtime.
- After dispatch, the assistant does not monitor, poll, supervise, or intervene by default.
- The workflow executes independently until completion or failure.
- The assistant only re-enters if the user explicitly asks to inspect, review, intervene, or take over.

This keeps planning and execution separate:

- `planner` owns plan creation and dispatch
- `workflow` owns execution
- post-dispatch monitoring is opt-in, not automatic
