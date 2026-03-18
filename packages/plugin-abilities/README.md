# @openagents/plugin-abilities

Enforced, validated workflows for OpenCode agents.

## Overview

Abilities solve the fundamental problem with Skills: **LLMs ignore them**. With Abilities:

- Steps **must** run (enforced via hooks)
- Scripts run **deterministically** (no AI variance)
- Validation **guarantees** each step completed
- Multi-agent coordination **just works**

## Installation

### As OpenCode Plugin

Add to your `opencode.json`:

```json
{
  "plugin": [
    "file://./packages/plugin-abilities/src/opencode-plugin.ts"
  ],
  "abilities": {
    "enabled": true,
    "auto_trigger": true,
    "enforcement": "strict"
  }
}
```

### As Standalone Package

```bash
bun add @openagents/plugin-abilities
```

## Quick Start

### 1. Create an ability

```yaml
# .opencode/abilities/deploy/ability.yaml
name: deploy
description: Deploy with safety checks

triggers:
  keywords:
    - "deploy"
    - "ship it"

inputs:
  version:
    type: string
    required: true
    pattern: '^v\d+\.\d+\.\d+$'

steps:
  - id: test
    type: script
    run: npm test
    validation:
      exit_code: 0

  - id: build
    type: script
    run: npm run build
    needs: [test]

  - id: deploy
    type: script
    run: ./deploy.sh {{inputs.version}}
    needs: [build]
```

### 2. Run the ability

```bash
/ability run deploy --version=v1.2.3
```

Or let it auto-detect from natural language:

```
User: "Deploy v1.2.3 to production"
→ Ability detected: deploy
```

## Step Types

### Script

Runs a shell command deterministically.

```yaml
- id: test
  type: script
  run: npm test
  cwd: ./packages/api
  env:
    NODE_ENV: test
  validation:
    exit_code: 0
    stdout_contains: "passed"
  timeout: 5m
  on_failure: stop
```

### Agent

Calls an OpenAgents Control agent.

```yaml
- id: review
  type: agent
  agent: reviewer
  prompt: "Review the code changes"
  needs: [test]
```

### Skill

Loads an existing skill.

```yaml
- id: docs
  type: skill
  skill: generate-docs
```

### Approval

Human approval gate.

```yaml
- id: approve
  type: approval
  prompt: "Deploy to production?"
  when: inputs.environment == "production"
```

### Workflow

Nested workflow (calls another ability).

```yaml
- id: setup
  type: workflow
  workflow: setup-environment
  inputs:
    env: {{inputs.environment}}
```

## Input Validation

```yaml
inputs:
  version:
    type: string
    required: true
    pattern: '^v\d+\.\d+\.\d+$'
  
  count:
    type: number
    min: 1
    max: 100
    default: 10
  
  env:
    type: string
    enum: [dev, staging, prod]
```

## Dependencies

Steps can depend on other steps:

```yaml
steps:
  - id: test
    type: script
    run: npm test

  - id: build
    needs: [test]  # Runs after test completes
    type: script
    run: npm run build

  - id: deploy
    needs: [build]  # Runs after build completes
    type: script
    run: ./deploy.sh
```

## Conditional Execution

```yaml
- id: deploy-prod
  type: script
  run: ./deploy.sh prod
  when: inputs.environment == "production"
```

## Minimal Control Layer

The current runtime also supports a small control result surface for task types that need completion discipline.

Ability-level:

```yaml
task_type: paper_fulltext_review
```

Step-level evidence signaling:

```yaml
- id: extract
  type: script
  run: ./extract.sh
  tags: [fulltext-extract]

- id: card
  type: script
  run: ./write-card.sh
  tags: [reading-card]
```

When `task_type` is set, the executor returns:

- `executionStatus`: raw executor result
- `status`: final status after gate evaluation
- `control.obligations`: obligation states
- `control.gate`: `allow`, `warn`, or `block`

Built-in bibliography task types:

- `paper_screening`
- `paper_fulltext_review`
- `literature_decision`
- `section_evidence_pack`
- `citation_audit`

Built-in coding workflow task type:

- `code_change`

For `code_change`, runtime control now evaluates structured evidence beyond tags:

- required planning/scope evidence (`acceptance_criteria`, `affected_files`)
- implementation evidence (`changed_files`)
- validation evidence (`commands`, `results`, `exit_codes`)
- review evidence (`verdict`, `blocking_findings`)

Named gates for `code_change`:

- `validation_gate` — blocks when validation evidence is missing or reports failure
- `review_gate` — blocks when review evidence is missing, failed, or has blocking findings
- `scope_gate` — warns when declared scope evidence is incomplete
- `completion_claim_gate` — blocks completion claims without validation + review evidence
- `subtask_dependency_gate` — blocks when complex-path dependency violations are present

High-level development ability:

```bash
/ability run development/code-change --objective="..." --acceptance_criteria="..."
```

This ability provides deterministic stages for analyze, plan, context loading, execution (small/complex path), validation, review, and completion.

Bibliography command bridge:

```ts
await sdk.executeCommand('/paper-screening', '{"query":"retrieval augmented generation","limit":5}')
await sdk.executeCommand('/bibliography', 'review ABC12345')
```

Plugin tool bridge:

```text
ability.command({ command: "/paper-fulltext-review", arguments: "{\"zotero_key\":\"ABC12345\"}" })
```

## Enforcement

Abilities enforce execution order via hooks:

- **strict**: Block ALL tools outside current step (recommended)
- **normal**: Block destructive tools, warn on others
- **loose**: Advisory only

```yaml
settings:
  enforcement: strict
```

### How Enforcement Works

1. **tool.execute.before** - Blocks tools based on current step type:
   - Script steps: Block ALL tools (script runs deterministically)
   - Agent steps: Allow only agent invocation tools (task, background_task)
   - Approval steps: Block until user approves
   - Skill steps: Allow only skill-loading tools

2. **chat.message** - Injects ability context into every message:
   - Shows current ability name and progress
   - Shows current step instructions
   - Reminds AI what to do next

3. **session.idle** - Prevents session exit while ability running:
   - Injects continuation message
   - In strict mode, blocks exit until complete

### Always Allowed Tools

These tools are never blocked (read-only/status):

```
ability.list, ability.status, ability.cancel,
todoread, read, glob, grep,
lsp_hover, lsp_diagnostics, lsp_document_symbols
```

## Agent Attachment

Abilities can be attached to specific agents:

### In Ability Definition

```yaml
# Restrict to specific agents
compatible_agents:
  - deploy-agent
  - devops-agent

# Or exclusive to one agent
exclusive_agent: deploy-agent
```

### Via Agent Frontmatter

```markdown
---
name: deploy-agent
abilities:
  - deploy/production
  - deploy/staging
  - rollback
---
```

### Checking Agent Abilities

Use the `ability.agent` tool:

```
ability.agent({ agent: "deploy-agent" })
→ Lists all abilities available to that agent
```

## API

### Tools

- `ability.list` - List available abilities
- `ability.validate <name>` - Validate an ability
- `ability.run <name> [inputs]` - Execute an ability
- `ability.status` - Get active execution status

### Programmatic (SDK)

```typescript
import { createAbilitiesSDK } from '@openagents/plugin-abilities/sdk'

// Create SDK instance
const sdk = createAbilitiesSDK({
  projectDir: '.opencode/abilities',
  includeGlobal: true
})

// List all abilities
const abilities = await sdk.list()
// => [{ name, description, source, triggers, inputCount, stepCount }]

// Get specific ability
const ability = await sdk.get('deploy')

// Validate
const { valid, errors } = await sdk.validate('deploy')

// Execute with inputs
const result = await sdk.execute('deploy', { version: 'v1.2.3' })
// => { id, status, ability, duration, steps, formatted }

// Check status
const status = await sdk.status()
// => { active, ability, currentStep, progress, status }

// Cancel active execution
await sdk.cancel()

// Wait for completion (async)
const final = await sdk.waitFor(result.id, 60000)

// Cleanup when done
sdk.cleanup()
```

### Low-level API

```typescript
import { loadAbilities, executeAbility, validateAbility } from '@openagents/plugin-abilities'

// Load all abilities
const abilities = await loadAbilities({
  projectDir: '.opencode/abilities',
})

// Validate
const result = validateAbility(ability)

// Execute
const execution = await executeAbility(ability, inputs, context)
```

## File Structure

```
.opencode/
└── abilities/
    ├── deploy/
    │   └── ability.yaml
    ├── test-suite/
    │   └── ability.yaml
    └── simple.yaml
```

## Development

### Running Tests

```bash
cd packages/plugin-abilities
bun test
```

**Test Results:** 87 tests passing across 7 test files

### Test Coverage

- `executor.test.ts` - Script execution, step ordering, validation
- `validator.test.ts` - Ability validation, input validation
- `enforcement.test.ts` - Hook enforcement, agent attachment
- `integration.test.ts` - Full lifecycle, ExecutionManager, error handling
- `trigger.test.ts` - Keyword/pattern matching, auto-detection

### Building

```bash
bun run build
```

### Testing Plugin Locally

```bash
bun test-plugin.ts
```

## Implementation Status

- [x] Phase 1: Foundation (loader, validator, script executor)
- [x] Phase 2: Agent Integration (agent/skill/approval steps, triggers)
- [x] Phase 3: Enforcement (hooks, agent attachment, execution state)
- [x] Phase 4: Polish (context passing, nested workflows, SDK)

**All phases complete! 87 tests passing.**

## License

MIT
