# Example Agent Model Configurations

This document shows how to configure different models for various agents in OpenCode.

## Code Review Agent - High Performance Model

```yaml
---
id: reviewer
name: CodeReviewer
description: "Code review, security, and quality assurance agent"
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  read: true
  grep: true
  glob: true
  bash: false
  edit: false
  write: false
---

# Your code review agent content here...
```

## Copywriter Agent - Creative Model

```yaml
---
id: copywriter
name: Copywriter
description: "Creative content and copywriting specialist"
model: anthropic/claude-haiku-3-20241022
temperature: 0.7
tools:
  read: true
  write: true
  edit: true
---

# Your copywriter agent content here...
```

## Simple Tasks Agent - Cost-Effective Model

```yaml
---
id: simple-responder
name: Simple Responder
description: "Simple task responder for basic operations"
model: anthropic/claude-haiku-3-20241022
temperature: 0.2
tools:
  read: true
  bash: true
---

# Your simple responder agent content here...
```

## Context Analysis Agent - Specialized Model

```yaml
---
id: context-manager
name: ContextManager
description: "Context organization and lifecycle management specialist"
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  read: true
  grep: true
  glob: true
  edit: true
  write: true
  bash: true
---

# Your context manager agent content here...
```

## Recommended Model Assignments

- **High-precision tasks** (code review, security analysis): `anthropic/claude-sonnet-4-20250514`
- **Creative tasks** (copywriting, content creation): `anthropic/claude-haiku-3-20241022` with higher temperature
- **Simple tasks** (basic operations, simple queries): `anthropic/claude-haiku-3-20241022`
- **Complex reasoning** (architecture decisions, planning): `anthropic/claude-sonnet-4-20250514`
- **Cost-sensitive operations** (batch processing, simple automation): `anthropic/claude-haiku-3-20241022`

## Temperature Guidelines

- **0.0-0.2**: Very consistent, precise tasks (code analysis, security reviews)
- **0.3-0.5**: Balanced creativity and consistency (documentation, explanations)
- **0.6-0.8**: Creative tasks (copywriting, brainstorming)
- **0.9-1.0**: Highly creative tasks (storytelling, creative writing)

## Configuration Process

1. Edit the agent's `.md` file
2. Add `model:` parameter to the YAML frontmatter
3. Optionally adjust `temperature:` for the task type
4. Save the file
5. The next time you invoke that agent, it will use the specified model

## Global vs Project Configuration

- **Global**: `~/.config/opencode/agents/agent-name.md`
  - Available across all projects
  - Good for personal preferences
  
- **Project**: `.opencode/agents/agent-name.md`
  - Only available in current project
  - Good for project-specific requirements
  - Overrides global configuration if both exist