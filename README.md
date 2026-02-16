# OpenAgents Control (OAC)

Multi-agent orchestration and automation framework for AI-powered development workflows.

## 🚀 Quick Start

### Claude Code (BETA - via Plugin Marketplace)

OpenAgents Control is now available as a Claude Code plugin!

**Installation:**

1. Register the marketplace:
```bash
/plugin marketplace add darrenhinde/OpenAgentsControl
```

2. Install the plugin:
```bash
/plugin install oac
```

3. Download context files:
```bash
/oac:setup --core
```

4. Start building:
```
Add a login endpoint
```

**Features:**
- ✅ 6-stage workflow with approval gates
- ✅ Context-aware code generation
- ✅ Parallel task execution
- ✅ External documentation fetching
- ✅ Automatic cleanup management
- ✅ 9 specialized skills + 6 custom subagents

**Documentation:**
- [Plugin README](./plugins/claude-code/README.md) - Complete plugin documentation
- [First-Time Setup](./plugins/claude-code/FIRST-TIME-SETUP.md) - Step-by-step guide
- [Quick Start](./plugins/claude-code/QUICK-START.md) - Quick reference

**Status:** BETA - Actively tested and ready for early adopters

---

## 📚 About OpenAgents Control

OpenAgents Control is a comprehensive framework for orchestrating multiple AI agents to handle complex development workflows. It provides:

- **Multi-agent orchestration** - Coordinate specialized agents for different tasks
- **Context-aware execution** - Automatically discover and apply relevant coding standards
- **Task breakdown** - Decompose complex features into atomic, verifiable subtasks
- **Quality automation** - Built-in code review, testing, and documentation generation
- **Flexible architecture** - Works with multiple AI coding tools (Claude Code, OpenCode, Cursor, Windsurf)

## 🏗️ Architecture

OAC uses a **flattened delegation hierarchy** where:
- **Skills** orchestrate the workflow and guide the main agent
- **Subagents** execute specialized tasks in isolated contexts
- **Context files** provide coding standards and patterns
- **Approval gates** ensure user control over execution

## 📖 Documentation

- [Agents](./docs/agents/) - Custom agent documentation
- [Evals](./evals/) - Evaluation framework and tests
- [Planning](./docs/planning/) - Architecture and design documents
- [Context System](./docs/context-system/) - Context organization and management

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/darrenhinde/OpenAgentsControl/issues)
- **Discussions**: [GitHub Discussions](https://github.com/darrenhinde/OpenAgentsControl/discussions)

---

**Version**: 1.0.0-beta  
**Status**: Active Development  
**Last Updated**: 2026-02-16
