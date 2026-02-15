---
name: task-management
description: CLI for managing tasks, tracking progress, validating dependencies, and migrating schemas
version: 2.0.0
author: opencode
type: skill
category: development
tags:
  - tasks
  - management
  - tracking
  - dependencies
  - cli
---

# Task Management Skill

> **Purpose**: Track, manage, and validate feature implementations with atomic task breakdowns

## What I Do

- **Track progress** - See status of all features and their subtasks
- **Find next tasks** - Show eligible tasks (dependencies satisfied)
- **Identify blocked tasks** - See what's blocked and why
- **Manage completion** - Mark subtasks as complete with summaries
- **Validate integrity** - Check JSON files and dependency trees
- **Show context** - Display bounded context breakdown
- **Show contracts** - Display contract dependencies
- **Migrate schemas** - Upgrade tasks to enhanced schema

## Quick Start

```bash
# Show all task statuses
bash .opencode/skill/task-management/router.sh status

# Show next eligible tasks
bash .opencode/skill/task-management/router.sh next

# Mark a task complete
bash .opencode/skill/task-management/router.sh complete <feature> <seq> "summary"

# Validate all tasks
bash .opencode/skill/task-management/router.sh validate

# Show bounded context breakdown
bash .opencode/skill/task-management/router.sh context <feature>

# Show contract dependencies
bash .opencode/skill/task-management/router.sh contracts <feature>

# Migrate to enhanced schema
bash .opencode/skill/task-management/router.sh migrate <feature>
```

## Command Reference

| Command | Description |
|---------|-------------|
| `status [feature]` | Show task status summary |
| `next [feature]` | Show next eligible tasks (dependencies satisfied) |
| `parallel [feature]` | Show parallelizable tasks ready to run |
| `deps <feature> <seq>` | Show dependency tree for a specific subtask |
| `blocked [feature]` | Show blocked tasks and why |
| `complete <feature> <seq> "summary"` | Mark subtask complete with summary |
| `validate [feature]` | Validate JSON files and dependencies |
| `context [feature]` | Show bounded context breakdown |
| `contracts [feature]` | Show contract dependencies |
| `migrate <feature>` | Migrate to enhanced schema |
| `migrate <feature> --dry-run` | Preview migration changes |
| `migrate <feature> --lines-only` | Add only line-number precision |
| `help` | Show help message |

## Architecture

```
.opencode/skill/task-management/
├── SKILL.md                          # This file
├── router.sh                         # CLI router
└── scripts/
    ├── task-cli.ts                   # Task management CLI
    ├── migrate-schema.ts             # Schema migration tool
    └── validators/
        └── line-number-validator.ts  # Line-number validation
```

## Task File Structure

Tasks are stored in `.tmp/tasks/` at the project root:

```
.tmp/tasks/
├── {feature-slug}/
│   ├── task.json                     # Feature-level metadata
│   ├── subtask_01.json               # Subtask definitions
│   ├── subtask_02.json
│   └── ...
└── completed/
    └── {feature-slug}/               # Completed tasks
```

## File Locations

### Scripts
- **Task CLI**: `.opencode/skill/task-management/scripts/task-cli.ts`
- **Schema Migration**: `.opencode/skill/task-management/scripts/migrate-schema.ts`
- **Line Validator**: `.opencode/skill/task-management/scripts/validators/line-number-validator.ts`

### Runtime Files
- **Tasks**: `.tmp/tasks/{feature}/`
- **Completed**: `.tmp/tasks/completed/{feature}/`

### Documentation
- **Enhanced Schema**: `.opencode/context/core/task-management/standards/enhanced-task-schema.md`
- **Migration Guide**: `.opencode/docs/guides/task-schema-migration.md`

## Key Concepts

### 1. Dependency Resolution
Subtasks can depend on other subtasks. A task is "ready" only when all its dependencies are complete.

### 2. Parallel Execution
Set `parallel: true` to indicate a subtask can run alongside other parallel tasks with satisfied dependencies.

### 3. Status Tracking
- **pending** - Not started, waiting for dependencies
- **in_progress** - Currently being worked on
- **completed** - Finished with summary
- **blocked** - Explicitly blocked (not waiting for deps)

### 4. Exit Criteria
Each feature has exit_criteria that must be met before marking the feature complete.

### 5. Validation Rules

The `validate` command performs comprehensive checks on task files:

**Task-Level Validation:**
- ✅ task.json file exists for the feature
- ✅ Task ID matches feature slug
- ✅ Subtask count in task.json matches actual subtask files
- ✅ All required fields are present

**Subtask-Level Validation:**
- ✅ All subtask IDs start with feature name (e.g., "my-feature-01")
- ✅ Sequence numbers are unique and properly formatted (01, 02, etc.)
- ✅ All dependencies reference existing subtasks
- ✅ No circular dependencies exist
- ✅ Each subtask has acceptance criteria defined
- ✅ Each subtask has deliverables specified
- ✅ Status values are valid (pending, in_progress, completed, blocked)

**Dependency Validation:**
- ✅ All depends_on references point to existing subtasks
- ✅ No task depends on itself
- ✅ No circular dependency chains
- ✅ Dependency graph is acyclic

Run `validate` regularly to catch issues early:
```bash
bash .opencode/skill/task-management/router.sh validate my-feature
```

### 6. Context and Reference Files

**context_files** - Standards, conventions, and guidelines to follow
**reference_files** - Existing project files to look at or build upon

Both support two formats:

**String format** (legacy, still supported):
```json
"context_files": ["docs/standards.md"]
```

**Object format** (with line-number precision):
```json
"context_files": [
  {
    "path": "docs/standards.md",
    "lines": "10-50",
    "reason": "Pure function patterns"
  }
]
```

The object format reduces cognitive load by pointing to exact sections instead of entire files.

## Integration with TaskManager

The TaskManager subagent creates task files using this format. When you delegate to TaskManager:

```javascript
task(
  subagent_type="TaskManager",
  description="Implement feature X",
  prompt="Break down this feature into atomic subtasks..."
)
```

TaskManager creates:
1. `.tmp/tasks/{feature}/task.json` - Feature metadata
2. `.tmp/tasks/{feature}/subtask_XX.json` - Individual subtasks

TaskManager now supports enhanced schema generation with:
- **Line-number precision** for large context files
- **Domain modeling** fields (bounded_context, module, vertical_slice)
- **Contract tracking** for API dependencies
- **ADR references** for architectural decisions
- **Prioritization scores** (RICE, WSJF)

You can then use this skill to track and manage progress.

## Workflow Integration

### With TaskManager Subagent

1. **TaskManager creates tasks** → Generates `.tmp/tasks/{feature}/` structure
2. **You use this skill to track** → Monitor progress with `status`, `next`, `blocked`
3. **You mark tasks complete** → Use `complete` command with summaries
4. **Skill validates integrity** → Use `validate` to check consistency

### With Other Subagents

Working agents (CoderAgent, TestEngineer, etc.) execute subtasks and report completion. Use this skill to:
- Find next available tasks with `next`
- Check what's blocking progress with `blocked`
- Validate task definitions with `validate`

## Common Workflows

### Starting a New Feature

```bash
# 1. TaskManager creates the task structure
task(subagent_type="TaskManager", description="Implement feature X", ...)

# 2. Check what's ready
bash .opencode/skill/task-management/router.sh next

# 3. Delegate first task to working agent
task(subagent_type="CoderAgent", description="Implement subtask 01", ...)
```

### Tracking Progress

```bash
# Check overall status
bash .opencode/skill/task-management/router.sh status my-feature

# See what's next
bash .opencode/skill/task-management/router.sh next my-feature

# Check what's blocked
bash .opencode/skill/task-management/router.sh blocked my-feature
```

### Completing Tasks

```bash
# After working agent finishes
bash .opencode/skill/task-management/router.sh complete my-feature 05 "Implemented auth module with JWT support"

# Check progress
bash .opencode/skill/task-management/router.sh status my-feature

# Find next task
bash .opencode/skill/task-management/router.sh next my-feature
```

### Validating Everything

```bash
# Validate all tasks
bash .opencode/skill/task-management/router.sh validate

# Validate specific feature
bash .opencode/skill/task-management/router.sh validate my-feature
```

## Tips & Best Practices

### 1. Use Meaningful Summaries
When marking tasks complete, provide clear summaries:
```bash
# Good
complete my-feature 05 "Implemented JWT authentication with refresh tokens and error handling"

# Avoid
complete my-feature 05 "Done"
```

### 2. Check Dependencies Before Starting
```bash
# See what a task depends on
bash .opencode/skill/task-management/router.sh deps my-feature 07
```

### 3. Identify Parallelizable Work
```bash
# Find tasks that can run in parallel
bash .opencode/skill/task-management/router.sh parallel my-feature
```

### 4. Regular Validation
```bash
# Validate regularly to catch issues early
bash .opencode/skill/task-management/router.sh validate
```

### 5. Use Line-Number Precision for Large Files
When creating tasks with large context files, use line-number precision:
```json
{
  "path": ".opencode/context/core/standards/code-quality.md",
  "lines": "53-95",
  "reason": "Pure function and immutability patterns"
}
```

This helps agents focus on relevant sections instead of reading entire documents.

### 6. Track Contracts for API Dependencies
Use the `contracts` command to see API/interface dependencies:
```bash
bash .opencode/skill/task-management/router.sh contracts my-feature
```

### 7. View Domain Organization
Use the `context` command to see bounded context breakdown:
```bash
bash .opencode/skill/task-management/router.sh context my-feature
```

## Troubleshooting

### "task-cli.ts not found"
Make sure you're running from the project root or the router.sh can find it.

### "No tasks found"
Run `status` to see if any tasks have been created yet. Use TaskManager to create tasks first.

### "Dependency not satisfied"
Check the dependency tree with `deps` to see what's blocking the task.

### "Validation failed"
Run `validate` to see specific issues, then check the JSON files in `.tmp/tasks/`.

## See Also
- Project Orchestration: `.opencode/skill/project-orchestration/SKILL.md`
- Planning Agents: `.opencode/docs/agents/planning-agents-guide.md`
- Task Schema: `.opencode/context/core/task-management/standards/enhanced-task-schema.md`
