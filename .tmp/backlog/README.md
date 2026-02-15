# Backlog Items

> **Purpose**: Store prioritized backlog items, feature requests, and implementation tasks ready for development.

## What Goes Here

This directory contains backlog artifacts that bridge planning and execution:

- **Feature Backlogs** - Prioritized lists of features and enhancements
- **User Stories** - Detailed user-facing requirements with acceptance criteria
- **Technical Tasks** - Implementation tasks derived from architecture and stories
- **Bug Reports** - Defects and issues requiring fixes
- **Refinement Notes** - Clarifications and decisions from backlog grooming
- **Estimation Data** - Effort estimates and complexity assessments

## File Naming Convention

Use descriptive, kebab-case names with priority or sprint indicators:

```
{feature-name}-backlog.md
{sprint-name}-stories.md
{feature-name}-technical-tasks.md
{priority}-{feature-name}.md
```

## Example Files

See example backlog items in this directory to understand the expected format and detail level.

## Workflow Integration

1. **Story maps** are decomposed into backlog items
2. **ArchitectAgent** adds technical context to backlog items
3. **TaskManager** breaks backlog items into atomic subtasks
4. **CoderAgent** implements subtasks from the backlog
5. **TestEngineer** validates completed backlog items

## Backlog Item Structure

A well-formed backlog item includes:

```markdown
## Title
Brief description of the feature or task

## User Story (if applicable)
As a [persona], I want [capability] so that [benefit]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
Architecture references, dependencies, constraints

## Estimation
Effort estimate and complexity assessment

## Priority
High / Medium / Low with rationale
```

## Best Practices

- Keep items small and independently deliverable
- Include clear acceptance criteria
- Link to architecture and story map documents
- Prioritize by value and risk
- Refine items before implementation
- Track dependencies explicitly
- Update status as work progresses

---

**Note**: This directory is part of the `.tmp/` workspace and is gitignored by default. Archive completed backlog items to permanent locations for historical reference.
