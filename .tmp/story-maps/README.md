# Story Maps

> **Purpose**: Store user story maps and journey flows that guide feature development from a user-centric perspective.

## What Goes Here

This directory contains story mapping artifacts created during the discovery and planning phases:

- **User Journey Maps** - End-to-end user flows and touchpoints
- **Story Maps** - Hierarchical breakdown of user activities, tasks, and stories
- **Persona Definitions** - User archetypes and their goals, needs, and pain points
- **Feature Prioritization** - MVP slicing and release planning
- **User Scenarios** - Concrete examples of how users will interact with features
- **Acceptance Criteria** - User-facing validation criteria for stories

## File Naming Convention

Use descriptive, kebab-case names that identify the feature or user journey:

```
{feature-name}-story-map.md
{feature-name}-user-journey.md
{persona-name}-persona.md
{feature-name}-scenarios.md
```

## Example Files

See example story maps in this directory to understand the expected format and structure.

## Workflow Integration

1. **Product planning** creates initial story maps and user journeys
2. **ArchitectAgent** references story maps when designing technical solutions
3. **TaskManager** uses story maps to ensure implementation aligns with user needs
4. **TestEngineer** derives test scenarios from user stories and acceptance criteria

## Story Map Structure

A typical story map includes:

```
User Activities (high-level goals)
  └── User Tasks (steps to achieve goals)
      └── User Stories (specific features/capabilities)
          └── Acceptance Criteria (validation rules)
```

## Best Practices

- Start with user goals, not technical features
- Use concrete personas and scenarios
- Prioritize stories by user value and risk
- Keep stories small and testable
- Link stories to architectural decisions
- Update story maps as understanding evolves

---

**Note**: This directory is part of the `.tmp/` workspace and is gitignored by default. Archive important story maps to permanent locations when features are completed.
