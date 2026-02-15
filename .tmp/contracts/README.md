# Agent Contracts

> **Purpose**: Store formal contracts and interfaces between agents in multi-stage orchestration workflows.

## What Goes Here

This directory contains contract definitions that govern agent interactions and handoffs:

- **Agent Interface Contracts** - Input/output specifications for each agent
- **Handoff Protocols** - Rules for passing work between workflow stages
- **Data Schemas** - Structured formats for artifacts exchanged between agents
- **Validation Rules** - Criteria for accepting work from upstream agents
- **Error Handling Protocols** - How agents handle and escalate failures
- **Context Requirements** - What context each agent needs to operate

## File Naming Convention

Use descriptive, kebab-case names that identify the contract type and agents involved:

```
{agent-name}-contract.md
{source-agent}-to-{target-agent}-handoff.md
{artifact-type}-schema.json
{workflow-name}-protocol.md
```

## Example Files

See example contracts in this directory to understand the expected format and completeness.

## Workflow Integration

1. **Workflow design** defines agent contracts and handoff protocols
2. **Each agent** validates inputs against contract specifications
3. **Orchestrator** enforces contracts during agent delegation
4. **Monitoring** tracks contract compliance and violations

## Contract Structure

A typical agent contract includes:

```markdown
## Agent: {AgentName}

### Purpose
What this agent does in the workflow

### Inputs
- Required context files
- Expected artifact formats
- Dependency requirements

### Outputs
- Deliverable artifacts
- Status updates
- Handoff criteria

### Validation Rules
- Input validation criteria
- Output quality gates
- Error conditions

### Dependencies
- Upstream agents
- Required tools/services
- Context requirements
```

## Best Practices

- Define contracts before implementing workflows
- Make contracts explicit and testable
- Version contracts when they change
- Validate inputs at agent boundaries
- Document error handling clearly
- Keep contracts focused and minimal
- Use schemas for structured data
- Test contract compliance regularly

---

**Note**: This directory is part of the `.tmp/` workspace and is gitignored by default. Archive stable contracts to permanent locations for reuse across workflows.
