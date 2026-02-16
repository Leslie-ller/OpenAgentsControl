# Claude Code Plugin - Gap Analysis & Recommendations

**Date**: 2026-02-16  
**Status**: Production-ready with identified gaps  
**PR**: #219

---

## Executive Summary

The Claude Code plugin is **production-ready** but has **4 critical gaps** that affect user experience and workflow efficiency:

1. ❌ **Missing Planning Command** - No easy way to plan/break down tasks
2. ❌ **Missing Context Addition Command** - No way to add context files easily
3. ⚠️ **Inconsistent Subagent Invocation** - Format varies across skills
4. ⚠️ **Explorer/ContextScout Behavior** - Not fully consistent with OpenCode

---

## Gap 1: Missing Planning Command ❌

### Current State

**What exists**:
- `/task-breakdown` skill - Invokes task-manager subagent
- Requires user to manually invoke via skill syntax
- Part of Stage 4 (Execute) in 6-stage workflow

**Problem**:
- Users must type: "Use the task-manager subagent to break down..."
- No simple slash command like `/oac:plan` or `/oac:breakdown`
- Planning is buried in execution stage, not easily accessible

### Recommended Solution

**Add new command**: `/oac:plan`

**Purpose**: Make task planning/breakdown easily accessible

**Implementation**:
```markdown
---
name: oac:plan
description: Plan and break down a complex feature into atomic subtasks
argument-hint: [feature description]
---

# Plan Feature

Break down the following feature into atomic subtasks: $ARGUMENTS

## Process

1. **Analyze requirements** - Understand scope and complexity
2. **Discover context** - Find relevant standards and patterns
3. **Create task breakdown** - Generate subtask files with dependencies
4. **Present plan** - Show task structure and execution order

## Invocation

This command invokes the task-manager subagent with pre-loaded context to create:
- `.tmp/tasks/{feature}/task.json` - Feature metadata
- `.tmp/tasks/{feature}/subtask_NN.json` - Individual subtasks

## Usage Examples

```bash
# Plan a feature
/oac:plan user authentication system

# Plan with specific context
/oac:plan API rate limiting (security focus)

# Plan with constraints
/oac:plan payment integration (PCI compliance required)
```

## Output

Task files created in `.tmp/tasks/{feature}/` with:
- Clear dependencies
- Parallel execution flags
- Acceptance criteria
- Suggested agents
```

**Benefits**:
- ✅ Easy to discover and use
- ✅ Separates planning from execution
- ✅ Consistent with other `/oac:*` commands
- ✅ Reduces cognitive load for users

---

## Gap 2: Missing Context Addition Command ❌

### Current State

**What exists**:
- `/oac:setup` - Downloads context from GitHub
- `/context-manager` skill - Manages context configuration
- Manual file creation for custom context

**Problem**:
- No easy way to add custom context files
- No command to add context from GitHub worktrees
- Users must manually create files in `.opencode/context/`

### Recommended Solution

**Add new command**: `/oac:add-context`

**Purpose**: Easily add context files from various sources

**Implementation**:
```markdown
---
name: oac:add-context
description: Add context files from GitHub, worktrees, or local files
argument-hint: [source] [options]
---

# Add Context

Add context files to your project: $ARGUMENTS

## Sources

### 1. GitHub Repository
```bash
# Add from GitHub repo
/oac:add-context github:owner/repo

# Add specific path
/oac:add-context github:owner/repo/path/to/context

# Add specific branch/tag
/oac:add-context github:owner/repo#branch-name
```

### 2. Git Worktree
```bash
# Add from worktree
/oac:add-context worktree:/path/to/worktree

# Add specific subdirectory
/oac:add-context worktree:/path/to/worktree/context
```

### 3. Local Files
```bash
# Add local file
/oac:add-context file:./path/to/context.md

# Add local directory
/oac:add-context file:./path/to/context/
```

### 4. URL
```bash
# Add from URL
/oac:add-context url:https://example.com/context.md
```

## Options

- `--category=<name>` - Specify context category (default: custom)
- `--priority=<level>` - Set priority (critical, high, medium)
- `--overwrite` - Overwrite existing files
- `--dry-run` - Preview what would be added

## Examples

```bash
# Add team standards from GitHub
/oac:add-context github:acme-corp/standards --category=team

# Add from worktree
/oac:add-context worktree:../team-context --category=team

# Add custom pattern
/oac:add-context file:./docs/patterns/auth.md --category=custom --priority=high

# Preview before adding
/oac:add-context github:owner/repo --dry-run
```

## What It Does

1. **Fetches content** from specified source
2. **Validates format** (checks for proper markdown structure)
3. **Copies to** `.opencode/context/{category}/`
4. **Updates navigation** (adds to navigation.md)
5. **Verifies** context is discoverable

## Output

```
✅ Added 3 context files to .opencode/context/team/

Files added:
- .opencode/context/team/standards/code-quality.md
- .opencode/context/team/patterns/auth.md
- .opencode/context/team/workflows/deployment.md

Updated navigation:
- .opencode/context/team/navigation.md

Verification:
✅ All files discoverable via /context-discovery
```
```

**Benefits**:
- ✅ Easy context addition from multiple sources
- ✅ Supports GitHub worktrees (key requirement)
- ✅ Validates and organizes automatically
- ✅ Updates navigation for discoverability

---

## Gap 3: Inconsistent Subagent Invocation ⚠️

### Current State

**Skill invocation format** (via frontmatter):
```markdown
---
name: context-discovery
context: fork
agent: context-scout
---
```

**Problem**: Skills pass context inconsistently to subagents

### Analysis of Current Patterns

#### Pattern 1: Context Discovery (GOOD)
```markdown
# File: skills/context-discovery/SKILL.md

---
context: fork
agent: context-scout
---

Discover context files for: **$ARGUMENTS**
```

**What happens**:
1. Main agent invokes skill
2. Skill forks to context-scout subagent
3. Subagent receives: "Discover context files for: {user request}"
4. ✅ Clean, simple, works well

#### Pattern 2: Task Breakdown (GOOD)
```markdown
# File: skills/task-breakdown/SKILL.md

---
context: fork
agent: task-manager
---

Break down this feature into atomic subtasks: $ARGUMENTS

## Your Task
{detailed instructions}
```

**What happens**:
1. Main agent invokes skill
2. Skill forks to task-manager subagent
3. Subagent receives full skill content as prompt
4. ✅ Includes instructions and context

#### Pattern 3: Code Execution (NEEDS IMPROVEMENT)
```markdown
# File: skills/code-execution/SKILL.md

---
context: fork
agent: coder-agent
---

# Code Execution Skill

Implement: $ARGUMENTS

{long instructions about what to do}
```

**Problem**: 
- Instructions are in skill file, not clear if subagent sees them
- No explicit "Context to load first" section
- Unclear how pre-loaded context is passed

### Recommended Solution

**Standardize all skill → subagent invocations**:

```markdown
---
name: skill-name
description: Brief description
context: fork
agent: subagent-name
---

# Skill Name

> **Subagent**: {subagent-name}  
> **Purpose**: {what this does}

---

## Task

{Clear, concise task description}: $ARGUMENTS

---

## Context Pre-Loaded

The main agent has already loaded these context files (Stage 3):

- {list of context files from Stage 1 discovery}

**Important**: Do NOT attempt to discover context. Use what's provided above.

---

## Instructions

{Step-by-step instructions for subagent}

1. {Step 1}
2. {Step 2}
3. {Step 3}

---

## Deliverables

Return:
- {Expected output 1}
- {Expected output 2}

---

## Quality Checklist

Before returning, verify:
- [ ] {Criterion 1}
- [ ] {Criterion 2}
```

**Benefits**:
- ✅ Consistent format across all skills
- ✅ Explicit context passing
- ✅ Clear instructions for subagents
- ✅ Quality checklist ensures completeness

### Files to Update

1. `skills/code-execution/SKILL.md` - Add context section
2. `skills/test-generation/SKILL.md` - Add context section
3. `skills/code-review/SKILL.md` - Add context section
4. `skills/external-scout/SKILL.md` - Clarify context handling
5. `skills/parallel-execution/SKILL.md` - Add context section

---

## Gap 4: Explorer/ContextScout Behavior ⚠️

### Current State

**ContextScout subagent**:
- ✅ Navigation-driven discovery (reads navigation.md)
- ✅ Read-only (Glob, Grep, Read tools only)
- ✅ Returns ranked results (Critical → High → Medium)
- ✅ Verifies paths exist before recommending

**Comparison with OpenCode**:

| Feature | OpenCode | Claude Code | Status |
|---------|----------|-------------|--------|
| Navigation-driven | ✅ | ✅ | ✅ Same |
| Read-only tools | ✅ | ✅ | ✅ Same |
| Ranked results | ✅ | ✅ | ✅ Same |
| Global fallback | ✅ | ✅ | ✅ Same |
| Nested calls | ✅ | ❌ | ⚠️ Different (by design) |
| Context pre-loading | ❌ | ✅ | ⚠️ Different (required) |

### Key Differences (By Design)

#### 1. Nested Calls

**OpenCode**:
```
Main Agent → TaskManager → CoderAgent → ContextScout
```
- Subagents can call ContextScout when needed
- Dynamic context discovery during execution

**Claude Code**:
```
Main Agent → ContextScout (Stage 1)
Main Agent → Read all files (Stage 3)
Main Agent → TaskManager/CoderAgent (Stage 4)
```
- Only main agent can call ContextScout
- Context pre-loaded before execution
- Prevents nested calls (Claude Code constraint)

**Impact**: ✅ Acceptable - enforced by Claude Code architecture

#### 2. Context Pre-Loading

**OpenCode**:
- Subagents discover context as needed
- Lazy loading during execution

**Claude Code**:
- Main agent discovers all context upfront (Stage 1)
- Main agent loads all context (Stage 3)
- Subagents use pre-loaded context (Stage 4+)

**Impact**: ✅ Acceptable - required for flat hierarchy

### Recommended Improvements

#### Improvement 1: Explicit Context Passing

**Current**: Subagents assume context is available

**Recommended**: Main agent explicitly passes context in delegation

**Example**:
```markdown
Invoke coder-agent subagent:

**Task**: Implement JWT authentication service

**Context Pre-Loaded** (from Stage 3):
- .opencode/context/core/standards/code-quality.md
- .opencode/context/core/standards/security-patterns.md
- .opencode/context/core/standards/typescript.md

**Key Requirements** (extracted from context):
- Use functional patterns (no classes)
- RS256 algorithm for JWT signing
- Token expiry: 15 minutes (access), 7 days (refresh)
- Error handling: throw typed errors

**Instructions**: Implement following loaded standards.
```

**Benefits**:
- ✅ Subagent knows exactly what context is available
- ✅ Key requirements extracted and highlighted
- ✅ No ambiguity about what to follow

#### Improvement 2: ContextScout Recommendations

**Current**: ContextScout returns file paths only

**Recommended**: ContextScout also extracts key requirements

**Example**:
```markdown
# Context Files Found

## Critical Priority

**File**: `.opencode/context/core/standards/code-quality.md`
**Contains**: Code quality standards, functional patterns, error handling
**Why**: Defines coding patterns you must follow

**Key Requirements**:
- Functional patterns (no classes)
- Pure functions where possible
- Explicit error handling
- TypeScript strict mode

---

**File**: `.opencode/context/core/standards/security-patterns.md`
**Contains**: Security best practices, auth patterns
**Why**: Critical for authentication implementation

**Key Requirements**:
- RS256 for JWT signing
- Token rotation required
- Secure secret storage
- Rate limiting on auth endpoints
```

**Benefits**:
- ✅ Main agent can extract requirements immediately
- ✅ Reduces need to re-read files
- ✅ Highlights critical requirements
- ✅ Faster context application

---

## Recommendations Summary

### High Priority (Implement Before Merge)

1. **Add `/oac:plan` command** - Makes planning easily accessible
2. **Add `/oac:add-context` command** - Enables GitHub worktree integration
3. **Standardize skill → subagent format** - Ensures consistent context passing

### Medium Priority (Post-Merge)

4. **Enhance ContextScout output** - Extract key requirements from context files
5. **Add context validation** - Verify context files are properly formatted
6. **Add context versioning** - Track context file versions and updates

### Low Priority (Future Enhancement)

7. **Add context search** - Search across all context files
8. **Add context templates** - Pre-built context file templates
9. **Add context analytics** - Track which context files are most used

---

## Implementation Plan

### Phase 1: Critical Commands (1-2 hours)

**Task 1**: Create `/oac:plan` command
- File: `plugins/claude-code/commands/oac-plan.md`
- Invokes: task-manager subagent
- Output: Task breakdown in `.tmp/tasks/{feature}/`

**Task 2**: Create `/oac:add-context` command
- File: `plugins/claude-code/commands/oac-add-context.md`
- Supports: GitHub, worktrees, local files, URLs
- Output: Context files in `.opencode/context/{category}/`

**Task 3**: Update help documentation
- File: `plugins/claude-code/commands/oac-help.md`
- Add: New commands to command list
- Add: Usage examples

### Phase 2: Standardize Skills (2-3 hours)

**Task 1**: Create skill template
- File: `plugins/claude-code/context/openagents-repo/templates/skill-template.md`
- Include: Standard sections (Task, Context, Instructions, Deliverables)

**Task 2**: Update existing skills
- Files: All `skills/*/SKILL.md` files
- Apply: Standard format
- Add: Explicit context passing sections

**Task 3**: Update subagent documentation
- Files: All `agents/*.md` files
- Clarify: Context pre-loading expectations
- Add: Examples of context usage

### Phase 3: Enhance ContextScout (3-4 hours)

**Task 1**: Update ContextScout prompt
- File: `plugins/claude-code/agents/context-scout.md`
- Add: Key requirement extraction
- Add: Requirement prioritization

**Task 2**: Update context-discovery skill
- File: `plugins/claude-code/skills/context-discovery/SKILL.md`
- Update: Response format to include requirements
- Add: Examples of enhanced output

**Task 3**: Update using-oac workflow
- File: `plugins/claude-code/skills/using-oac/SKILL.md`
- Update: Stage 3 to extract requirements
- Add: Requirement passing to subagents

---

## Testing Plan

### Test 1: Planning Command

**Scenario**: User wants to plan a complex feature

**Steps**:
1. Run: `/oac:plan user authentication system`
2. Verify: Task files created in `.tmp/tasks/user-authentication-system/`
3. Verify: Subtasks have dependencies and parallel flags
4. Verify: Context files referenced correctly

**Expected**: Task breakdown with 4-6 subtasks, clear dependencies

### Test 2: Add Context Command

**Scenario**: User wants to add team standards from GitHub

**Steps**:
1. Run: `/oac:add-context github:acme-corp/standards --category=team`
2. Verify: Files downloaded to `.opencode/context/team/`
3. Verify: Navigation updated
4. Run: `/context-discovery team coding standards`
5. Verify: New context files discovered

**Expected**: Context files added and discoverable

### Test 3: Consistent Invocation

**Scenario**: User implements a feature using multiple subagents

**Steps**:
1. Run: `/context-discovery authentication`
2. Verify: Context files returned with requirements
3. Run: `/task-breakdown authentication system`
4. Verify: Task manager receives context list
5. Run: `/code-execution implement JWT service`
6. Verify: Coder agent receives context and requirements

**Expected**: All subagents receive consistent context format

### Test 4: ContextScout Enhancement

**Scenario**: User discovers context for security-sensitive feature

**Steps**:
1. Run: `/context-discovery payment processing`
2. Verify: Context files returned
3. Verify: Key requirements extracted (PCI compliance, encryption, etc.)
4. Verify: Requirements prioritized

**Expected**: Context files + extracted requirements

---

## Risk Assessment

### Risk 1: Breaking Changes

**Risk**: Updating skill format breaks existing workflows

**Mitigation**:
- Maintain backward compatibility
- Add new sections without removing old ones
- Test all existing workflows after changes

**Likelihood**: Low  
**Impact**: High  
**Mitigation Status**: ✅ Planned

### Risk 2: Command Confusion

**Risk**: Too many commands confuse users

**Mitigation**:
- Clear naming conventions (`/oac:*`)
- Comprehensive help documentation
- Examples in `/oac:help`

**Likelihood**: Medium  
**Impact**: Low  
**Mitigation Status**: ✅ Planned

### Risk 3: Context Overload

**Risk**: Adding too much context slows down workflow

**Mitigation**:
- Lazy loading (only load what's needed)
- Prioritization (Critical → High → Medium)
- Caching (avoid re-downloading)

**Likelihood**: Low  
**Impact**: Medium  
**Mitigation Status**: ✅ Already implemented

---

## Success Criteria

### User Experience

- ✅ Users can plan features with one command (`/oac:plan`)
- ✅ Users can add context from GitHub/worktrees easily
- ✅ Users understand what context is loaded and why
- ✅ Subagents receive consistent, clear instructions

### Technical Quality

- ✅ All skills follow standard format
- ✅ Context passing is explicit and verifiable
- ✅ ContextScout extracts key requirements
- ✅ No breaking changes to existing workflows

### Documentation

- ✅ All new commands documented in `/oac:help`
- ✅ Examples provided for each command
- ✅ Skill template available for reference
- ✅ Migration guide for existing users

---

## Conclusion

The Claude Code plugin is **production-ready** with the current feature set, but adding these enhancements will significantly improve user experience and workflow efficiency.

**Recommendation**: 
1. ✅ Merge PR #219 as-is (current state is functional)
2. 🔄 Create follow-up PR for Phase 1 (critical commands)
3. 🔄 Create follow-up PR for Phase 2 (standardization)
4. 🔄 Create follow-up PR for Phase 3 (enhancements)

**Timeline**:
- Phase 1: 1-2 hours (high priority)
- Phase 2: 2-3 hours (medium priority)
- Phase 3: 3-4 hours (low priority)

**Total effort**: 6-9 hours across 3 PRs

---

**Last Updated**: 2026-02-16  
**Author**: OpenAgents Control Team  
**Status**: Ready for Review
