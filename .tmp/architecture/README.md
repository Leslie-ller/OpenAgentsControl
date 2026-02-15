# Architecture Artifacts

> **Purpose**: Store architectural design documents, system diagrams, and technical specifications generated during the planning phase.

## What Goes Here

This directory contains architectural artifacts created by the ArchitectAgent during multi-stage orchestration workflows:

- **System Architecture Diagrams** - High-level system design and component relationships
- **Technical Specifications** - Detailed technical requirements and constraints
- **API Design Documents** - Endpoint specifications, data models, and contracts
- **Database Schemas** - Entity relationships, table structures, and migrations
- **Integration Patterns** - Third-party service integrations and communication flows
- **Security Architecture** - Authentication, authorization, and data protection strategies

## File Naming Convention

Use descriptive, kebab-case names that include the feature or system being designed:

```
{feature-name}-architecture.md
{feature-name}-api-spec.md
{feature-name}-database-schema.md
{feature-name}-integration-design.md
```

## Example Files

See example architecture documents in this directory to understand the expected format and level of detail.

## Workflow Integration

1. **ArchitectAgent** creates architecture documents during planning phase
2. **TaskManager** references these documents when breaking down implementation tasks
3. **CoderAgent** uses these as blueprints during implementation
4. **ReviewAgent** validates implementation against architectural specifications

## Best Practices

- Keep documents focused and modular (one concern per document)
- Use diagrams and visual aids where helpful
- Include rationale for key architectural decisions
- Document assumptions and constraints
- Version control all architecture changes
- Link to related story maps and backlog items

---

**Note**: This directory is part of the `.tmp/` workspace and is gitignored by default. Archive important architecture documents to permanent locations when features are completed.
