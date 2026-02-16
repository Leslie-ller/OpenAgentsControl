---
name: oac:help
description: Show usage guide for OpenAgents Control workflow, skills, and commands
argument-hint: [skill-name]
---

# OpenAgents Control - Help Guide

$ARGUMENTS

## 🎯 Overview

OpenAgents Control (OAC) brings intelligent multi-agent orchestration to Claude Code with a 6-stage workflow for context-aware development.

## 🏗️ How Everything Works Together

### Architecture Flow

```
User Request
    ↓
┌─────────────────────────────────────────────────────────────┐
│ using-oac skill (6-stage workflow)                          │
│                                                              │
│  Stage 1: Analyze & Discover                                │
│      ↓                                                       │
│      └─→ /context-discovery → context-scout subagent        │
│                                                              │
│  Stage 2: Plan & Approve                                    │
│      ↓                                                       │
│      └─→ Present plan → REQUEST USER APPROVAL               │
│                                                              │
│  Stage 3: LoadContext                                       │
│      ↓                                                       │
│      ├─→ Read discovered context files                      │
│      └─→ /external-scout (if external packages needed)      │
│                                                              │
│  Stage 4: Execute                                           │
│      ↓                                                       │
│      ├─→ Simple: Direct implementation                      │
│      └─→ Complex: /task-breakdown → task-manager subagent   │
│           ↓                                                  │
│           ├─→ /code-execution → coder-agent subagent        │
│           ├─→ /test-generation → test-engineer subagent     │
│           └─→ /code-review → code-reviewer subagent         │
│                                                              │
│  Stage 5: Validate                                          │
│      ↓                                                       │
│      └─→ Run tests, verify acceptance criteria              │
│                                                              │
│  Stage 6: Complete                                          │
│      ↓                                                       │
│      └─→ Update docs, summarize changes                     │
└─────────────────────────────────────────────────────────────┘
    ↓
Deliverables returned to user
```

### Skill → Subagent Mapping

| Skill | Invokes | Primary Tools | Purpose |
|-------|---------|---------------|---------|
| `/using-oac` | N/A (orchestrator) | All | Main workflow orchestration through 6 stages |
| `/context-discovery` | `context-scout` | Read, Glob, Grep | Discover relevant context files and standards |
| `/task-breakdown` | `task-manager` | Read, Write, Bash | Break complex features into atomic subtasks |
| `/code-execution` | `coder-agent` | Read, Write, Edit, Bash | Implement code following discovered standards |
| `/test-generation` | `test-engineer` | Read, Write, Bash | Generate comprehensive tests using TDD |
| `/code-review` | `code-reviewer` | Read, Grep, Bash | Perform security and quality code review |
| `/external-scout` | N/A (direct API) | WebFetch, Context7 | Fetch live documentation for external packages |

### Configuration Hierarchy

OAC uses a layered configuration system with the following priority:

```
1. .oac (current directory)
   ↓ Project-specific settings
   ↓ Overrides global and built-in defaults
   ↓
2. ~/.oac (home directory)
   ↓ Personal defaults across all projects
   ↓ Overrides built-in defaults
   ↓
3. Built-in defaults (plugins/claude-code/.oac.example)
   ↓ Fallback when no custom config exists
```

**Configuration sections**:
- `context.*` - Context download and caching behavior
- `cleanup.*` - Temporary file cleanup settings
- `workflow.*` - Workflow automation preferences
- `external_scout.*` - External documentation fetching

**Example**: If you set `workflow.auto_approve: true` in `~/.oac`, it applies to all projects unless a specific project's `.oac` overrides it.

## 📋 6-Stage Workflow

The OAC workflow ensures context-aware, high-quality code delivery:

### Stage 1: Analyze & Discover
- Understand requirements and scope
- Invoke `/context-discovery` to find relevant context files
- Identify project standards, patterns, and conventions

### Stage 2: Plan & Approve
- Present implementation plan
- **REQUEST APPROVAL** before proceeding
- Confirm approach with user

### Stage 3: LoadContext
- Read all discovered context files
- Load coding standards, security patterns, naming conventions
- Pre-load context for execution stage

### Stage 4: Execute
- **Simple tasks**: Direct implementation
- **Complex tasks**: Invoke `/task-breakdown` to decompose into subtasks
- Follow loaded standards and patterns

### Stage 5: Validate
- Run tests and validation
- **STOP on failure** - fix before proceeding
- Verify acceptance criteria met

### Stage 6: Complete
- Update documentation
- Summarize changes
- Return results

## 🤖 Available Subagents

OAC provides specialized subagents for different tasks:

### task-manager
Break down complex features into atomic, verifiable subtasks with dependency tracking.

**When to use**: Complex features requiring multiple steps, parallel execution, or dependency management.

**Example**:
```
Use the task-manager subagent to break down this feature:
"Add user authentication with JWT tokens"
```

### context-scout
Discover relevant context files, standards, and patterns for your task.

**When to use**: Before implementing any feature, to find coding standards, security patterns, and conventions.

**Example**:
```
Use the context-scout subagent to find:
- TypeScript coding standards
- Security patterns for authentication
- API design conventions
```

### coder-agent
Execute coding subtasks with full context awareness and self-review.

**When to use**: Implementing specific features or subtasks following discovered standards.

**Example**:
```
Use the coder-agent subagent to implement:
- JWT authentication service
- Following security patterns from context
```

### test-engineer
Generate comprehensive tests using TDD principles.

**When to use**: Creating tests for new features or existing code.

**Example**:
```
Use the test-engineer subagent to create tests for:
- Authentication service
- Following test standards from context
```

### code-reviewer
Perform thorough code review with security and quality analysis.

**When to use**: Reviewing code changes before committing.

**Example**:
```
Use the code-reviewer subagent to review:
- Recent authentication changes
- Check security patterns and code quality
```

## 🎨 Available Skills

Skills guide the main agent through specific workflows:

### /using-oac
Main workflow orchestrator implementing the 6-stage process.

**Auto-invoked**: When you start a development task.

### /context-discovery
Guide for discovering and loading relevant context files.

**Usage**: `/context-discovery authentication feature`

### /task-breakdown
Guide for breaking down complex features into subtasks.

**Usage**: `/task-breakdown user authentication system`

### /code-execution
Guide for executing coding tasks with context awareness.

**Usage**: `/code-execution implement JWT service`

### /test-generation
Guide for generating comprehensive tests.

**Usage**: `/test-generation authentication service`

### /code-review
Guide for performing thorough code reviews.

**Usage**: `/code-review src/auth/`

## 📝 Available Commands

### /oac:setup
Download context files from GitHub repository.

**Usage**: `/oac:setup`

**What it does**:
- Fetches `.opencode/context/` from GitHub
- Validates context structure
- Creates `.context-manifest.json`

### /oac:help
Show this usage guide (you're reading it now!).

**Usage**: 
- `/oac:help` - Show general help
- `/oac:help <skill-name>` - Show help for specific skill

### /oac:status
Show plugin status and installed context.

**Usage**: `/oac:status`

**What it shows**:
- Plugin version
- Installed context version
- Available subagents and skills
- Context file count

## ⚙️ Configuration Setup

### First-Time Setup

1. **Download context files** (required):
   ```
   /oac:setup --core
   ```
   This downloads coding standards, security patterns, and conventions.

2. **Create configuration** (optional):
   ```bash
   # For project-specific settings
   cp plugins/claude-code/.oac.example .oac
   
   # For global settings
   cp plugins/claude-code/.oac.example ~/.oac
   ```

3. **Customize settings**:
   Edit `.oac` to configure:
   - Auto-download context updates
   - Cleanup schedules
   - Workflow preferences
   - External documentation sources

### Configuration Options

**Context settings**:
- `context.auto_download: true/false` - Auto-download context on first use
- `context.categories: core,openagents-repo` - Which context categories to load
- `context.update_check: true/false` - Check for context updates on startup
- `context.cache_days: 7` - How long to cache context before suggesting update

**Cleanup settings**:
- `cleanup.auto_prompt: true/false` - Prompt to clean old temporary files
- `cleanup.session_days: 7` - Days before session files are considered old
- `cleanup.task_days: 30` - Days before completed tasks are considered old
- `cleanup.external_days: 7` - Days before external cache is considered old

**Workflow settings**:
- `workflow.auto_approve: false` - **WARNING**: Skips approval gates (not recommended)
- `workflow.verbose: false` - Show detailed workflow progress

**External scout settings**:
- `external_scout.enabled: true/false` - Enable external documentation fetching
- `external_scout.cache_enabled: true/false` - Cache external docs locally
- `external_scout.sources: context7` - Documentation sources to use

## 🚀 Quick Start Examples

### Example 1: Simple Feature
```
User: "Add a login endpoint"

Claude (using-oac skill):
1. Analyze: Understand login requirements
2. Plan: Present implementation approach → REQUEST APPROVAL
3. LoadContext: Read API standards, security patterns
4. Execute: Implement endpoint directly
5. Validate: Run tests
6. Complete: Update API docs
```

### Example 2: Complex Feature
```
User: "Build a complete authentication system"

Claude (using-oac skill):
1. Analyze: Understand auth requirements
2. Plan: Present high-level approach → REQUEST APPROVAL
3. LoadContext: Read security patterns, API standards
4. Execute: Invoke /task-breakdown
   - Subtask 1: JWT service
   - Subtask 2: Auth middleware
   - Subtask 3: Login endpoint
   - Subtask 4: Refresh token logic
5. Validate: Run integration tests
6. Complete: Update docs, summarize
```

### Example 3: Using Subagents Directly
```
# Discover context first
Use the context-scout subagent to find TypeScript and security patterns.

# Break down complex task
Use the task-manager subagent to break down the authentication system.

# Implement subtask
Use the coder-agent subagent to implement JWT service following discovered patterns.

# Generate tests
Use the test-engineer subagent to create tests for the JWT service.

# Review code
Use the code-reviewer subagent to review all authentication changes.
```

## 🔑 Key Principles

### Context First, Code Second
Always discover and load context before implementing. This ensures your code follows project standards.

### Approval Gates
OAC requests approval before execution. This prevents unwanted changes and ensures alignment.

### Atomic Tasks
Complex features are broken into 1-2 hour subtasks with clear acceptance criteria.

### Self-Review
Every deliverable passes validation before completion (types, imports, anti-patterns, acceptance criteria).

### No Nested Calls
In Claude Code, only the main agent can invoke subagents. Skills orchestrate the workflow, subagents execute specialized tasks.

## 📚 Learn More

- **Installation**: See `INSTALL.md` for setup instructions
- **Quick Start**: See `QUICK-START.md` for getting started
- **Architecture**: See `README.md` for system overview
- **Context System**: Explore `context/` directory for standards and patterns

## 🆘 Troubleshooting

### "Context files not found"
Run `/oac:setup` to download context from GitHub.

### "Subagent not available"
Verify plugin installation with `/oac:status`.

### "Approval not requested"
This is a bug - OAC should always request approval before execution. Please report.

### "Nested subagent call error"
Claude Code doesn't support nested calls. Use skills to orchestrate, not subagents calling subagents.

## 💡 Tips

1. **Start with /oac:setup** - Download context files first
2. **Let the workflow guide you** - The using-oac skill handles orchestration
3. **Use context-scout early** - Discover standards before coding
4. **Break down complex tasks** - Use task-manager for multi-step features
5. **Review before committing** - Use code-reviewer for quality checks

---

**Version**: 1.0.0  
**Plugin**: oac  
**Last Updated**: 2026-02-16
