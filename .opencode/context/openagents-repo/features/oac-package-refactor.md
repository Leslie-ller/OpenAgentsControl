# Feature: OAC Package Refactor

**Purpose**: Transform OpenAgents Control into a flexible npm package with CLI tooling for multi-IDE support and community contributions

**Status**: In Development  
**Branch**: `feature/oac-package-refactor`  
**Priority**: CRITICAL  
**Version Target**: 1.0.0

---

## Vision

Transform `@nextsystems/oac` from a simple installer into a comprehensive CLI package manager that:
- ✅ Manages agents, skills, and contexts across multiple IDEs (OpenCode, Cursor, Claude Code, Windsurf)
- ✅ Provides flexible configuration for agent behavior and permissions
- ✅ Supports community contributions via shadcn-like component registry
- ✅ Handles context files from multiple locations
- ✅ Enables version management and updates
- ✅ Maintains backward compatibility with existing workflows

---

## Core Features

### 1. Multi-IDE Support

**Goal**: One configuration, multiple IDEs

```bash
# Configure once
oac configure

# Install for any IDE
oac install opencode
oac install cursor
oac install claude

# Apply updates to all
oac update --all
```

**Implementation**:
- Use compatibility layer adapters for IDE-specific translation
- Maintain single source of truth in OAC format
- Auto-detect IDE configurations
- Handle IDE-specific limitations gracefully

---

### 2. Flexible Configuration System

**Goal**: User-controlled agent behavior and permissions

**Configuration File**: `~/.config/oac/config.json` or `.oac/config.json`

```json
{
  "version": "1.0.0",
  "preferences": {
    "defaultIDE": "opencode",
    "installLocation": "local",
    "autoUpdate": false,
    "updateChannel": "stable"
  },
  "ides": {
    "opencode": {
      "enabled": true,
      "path": ".opencode",
      "profile": "developer"
    },
    "cursor": {
      "enabled": false,
      "path": ".cursor",
      "profile": "developer"
    }
  },
  "agents": {
    "behavior": {
      "approvalGates": true,
      "contextLoading": "lazy",
      "delegationThreshold": 4
    },
    "permissions": {
      "bash": "approve",
      "write": "approve",
      "edit": "approve",
      "task": "approve"
    }
  },
  "context": {
    "locations": [
      ".opencode/context",
      ".claude/context",
      "docs/context"
    ],
    "autoDiscover": true,
    "cacheEnabled": true
  }
}
```

**Commands**:
```bash
oac configure                              # Interactive wizard
oac configure set agents.permissions.bash auto
oac configure get ides.opencode.enabled
oac configure show
oac configure reset
```

---

### 3. Community Component Registry (shadcn-like)

**Goal**: Enable users to create and share custom agents, skills, and contexts

**Registry Structure**:
```json
{
  "version": "1.0.0",
  "official": {
    "agents": [...],
    "skills": [...],
    "contexts": [...]
  },
  "community": {
    "agents": [
      {
        "id": "rust-specialist",
        "name": "Rust Specialist",
        "author": "community-user",
        "source": "https://github.com/user/oac-rust-specialist",
        "version": "1.0.0",
        "downloads": 1234,
        "verified": false
      }
    ]
  }
}
```

**Commands**:
```bash
# Add component from registry
oac add agent:rust-specialist

# Add from GitHub URL
oac add https://github.com/user/oac-rust-specialist

# Add from local path
oac add ./my-custom-agent

# List available community components
oac browse agents
oac browse skills

# Publish your component
oac publish ./my-agent --type agent

# Search registry
oac search "rust"
```

**Component Package Format**:
```
my-custom-agent/
├── oac.json                 # Component metadata
├── agent.md                 # Agent prompt
├── tests/                   # Optional tests
│   └── smoke-test.yaml
├── context/                 # Optional context files
│   └── rust-patterns.md
└── README.md                # Documentation
```

**oac.json Schema**:
```json
{
  "name": "rust-specialist",
  "version": "1.0.0",
  "type": "agent",
  "description": "Expert in Rust programming",
  "author": "username",
  "license": "MIT",
  "repository": "https://github.com/user/oac-rust-specialist",
  "keywords": ["rust", "systems", "programming"],
  "dependencies": {
    "agents": [],
    "skills": [],
    "contexts": ["core/standards/code-quality"]
  },
  "files": {
    "agent": "agent.md",
    "tests": "tests/",
    "context": "context/"
  }
}
```

---

### 4. Context File Location Flexibility

**Goal**: Support context files in multiple locations with priority resolution

**Problem**: Context files can be in:
- `.opencode/context/`
- `.claude/context/`
- `docs/`
- Custom user locations
- Global shared contexts

**Solution**: Context Locator Service

```typescript
// Context resolution with priority
const locator = new ContextLocator(config);

// Resolves from configured locations in priority order
const path = await locator.resolve('core/standards/code-quality.md');
// Checks:
// 1. .opencode/context/core/standards/code-quality.md
// 2. .claude/context/core/standards/code-quality.md
// 3. docs/context/core/standards/code-quality.md
// 4. ~/global-context/core/standards/code-quality.md

// Discover all context files
const allContexts = await locator.discover();

// Validate references
const validation = await locator.validate([
  'core/standards/code-quality.md',
  'development/react-patterns.md'
]);
```

**Configuration**:
```json
{
  "context": {
    "locations": [
      ".opencode/context",
      ".claude/context",
      "docs/context",
      "~/global-context"
    ],
    "autoDiscover": true,
    "cacheEnabled": true
  }
}
```

---

### 5. Version Management & Updates

**Goal**: Keep agents and components up-to-date across all IDEs

```bash
# Check for updates
oac update --check

# Update all components
oac update

# Update and apply to specific IDE
oac update --claude --global
oac update --opencode --local

# Update specific component
oac update agent:openagent

# Update from specific version
oac update --version 0.8.0

# Rollback to previous version
oac rollback agent:openagent
```

**Update Flow**:
1. Fetch latest registry from GitHub
2. Compare with local cache
3. Show available updates
4. Download updated components
5. Apply to configured IDEs
6. Validate installation

---

## CLI Commands Reference

### Installation & Setup

```bash
oac init [profile]              # Initialize OAC in project
oac install [ide]               # Install for specific IDE
oac configure                   # Configure OAC settings
```

### Component Management

```bash
oac add <component>             # Add component from registry
oac remove <component>          # Remove component
oac list [--type]               # List installed components
oac search <query>              # Search registry
oac browse [type]               # Browse available components
```

### Updates & Sync

```bash
oac update [options]            # Update components
oac apply [ide]                 # Apply config to IDE
oac sync                        # Sync across all IDEs
```

### Publishing (Community)

```bash
oac publish <path>              # Publish component to registry
oac unpublish <component>       # Remove from registry
oac validate <path>             # Validate component package
```

### Utilities

```bash
oac doctor                      # Check installation health
oac clean                       # Clean cache and temp files
oac version                     # Show version info
oac help [command]              # Show help
```

---

## Architecture

### Directory Structure

```
@nextsystems/oac/
├── bin/
│   └── oac.js                  # CLI entry point
├── src/
│   ├── cli/
│   │   ├── commands/           # CLI command implementations
│   │   │   ├── init.ts
│   │   │   ├── install.ts
│   │   │   ├── configure.ts
│   │   │   ├── add.ts
│   │   │   ├── update.ts
│   │   │   ├── apply.ts
│   │   │   ├── publish.ts
│   │   │   └── ...
│   │   ├── config/
│   │   │   ├── manager.ts      # Configuration management
│   │   │   ├── schema.ts       # Zod schemas
│   │   │   └── defaults.ts     # Default configs
│   │   └── index.ts            # CLI orchestrator
│   ├── core/
│   │   ├── registry/
│   │   │   ├── loader.ts       # Load registry
│   │   │   ├── resolver.ts     # Resolve dependencies
│   │   │   ├── validator.ts    # Validate registry
│   │   │   └── publisher.ts    # Publish components
│   │   ├── installer/
│   │   │   ├── component.ts    # Install components
│   │   │   ├── profile.ts      # Install profiles
│   │   │   └── ide.ts          # IDE-specific setup
│   │   ├── updater/
│   │   │   ├── version.ts      # Version checking
│   │   │   ├── fetcher.ts      # Fetch updates
│   │   │   └── applier.ts      # Apply updates
│   │   └── context/
│   │       ├── locator.ts      # Find context files
│   │       ├── resolver.ts     # Resolve paths
│   │       └── validator.ts    # Validate refs
│   ├── adapters/
│   │   ├── base.ts             # Base adapter
│   │   ├── opencode.ts         # OpenCode adapter
│   │   ├── cursor.ts           # Cursor adapter
│   │   ├── claude.ts           # Claude Code adapter
│   │   └── windsurf.ts         # Windsurf adapter
│   ├── types/
│   │   ├── registry.ts         # Registry types
│   │   ├── config.ts           # Config types
│   │   └── component.ts        # Component types
│   └── utils/
│       ├── logger.ts           # Logging
│       ├── spinner.ts          # Progress indicators
│       └── prompts.ts          # Interactive prompts
├── config/
│   ├── oac.config.json         # Default config
│   └── ide-mappings.json       # IDE mappings
├── .opencode/                  # Existing structure
├── registry.json               # Official registry
├── community-registry.json     # Community registry
└── package.json
```

---

## Technical Stack

### Dependencies

```json
{
  "dependencies": {
    "commander": "^12.0.0",      // CLI framework
    "inquirer": "^9.2.0",        // Interactive prompts
    "zod": "^3.22.0",            // Schema validation
    "chalk": "^5.3.0",           // Terminal colors
    "ora": "^8.0.0",             // Spinners
    "boxen": "^7.1.0",           // Boxes
    "table": "^6.8.0",           // Tables
    "fs-extra": "^11.2.0",       // File system
    "glob": "^10.3.0",           // Pattern matching
    "semver": "^7.6.0",          // Version comparison
    "node-fetch": "^3.3.0",      // HTTP requests
    "yaml": "^2.3.0",            // YAML parsing
    "tar": "^6.2.0",             // Package extraction
    "simple-git": "^3.22.0"      // Git operations
  }
}
```

---

## Implementation Phases

### Phase 1: Core CLI Infrastructure (Week 1)
**Goal**: Set up CLI framework and configuration system

**Tasks**:
- Set up TypeScript project in `src/`
- Install dependencies (Commander, Zod, inquirer)
- Create configuration schema and manager
- Implement basic commands (init, configure, list)
- Write tests

**Deliverables**:
- `src/cli/index.ts`
- `src/cli/config/manager.ts`
- `src/cli/config/schema.ts`
- `oac configure` works
- `oac list` works

---

### Phase 2: Registry & Component Management (Week 2)
**Goal**: Component installation and management

**Tasks**:
- Port registry validation to TypeScript
- Implement registry loader and resolver
- Create component installer
- Implement profile installer
- Add dependency resolution

**Deliverables**:
- `src/core/registry/loader.ts`
- `src/core/installer/component.ts`
- `oac install opencode --profile developer` works

---

### Phase 3: IDE Adapters Integration (Week 3)
**Goal**: Multi-IDE support

**Tasks**:
- Move compatibility layer to `src/adapters/`
- Implement IDE-specific installers
- Create adapter registry
- Implement `oac apply` command
- Add IDE detection

**Deliverables**:
- `src/adapters/opencode.ts`
- `src/adapters/cursor.ts`
- `oac apply cursor` works

---

### Phase 4: Update System (Week 4)
**Goal**: Version management

**Tasks**:
- Create version checker
- Implement update fetcher
- Create update applier
- Implement `oac update` command
- Add update notifications

**Deliverables**:
- `src/core/updater/version.ts`
- `oac update --check` works
- `oac update --claude --global` works

---

### Phase 5: Context System (Week 5)
**Goal**: Flexible context locations

**Tasks**:
- Create context locator service
- Implement context resolver
- Add context validator
- Update agents to use locator
- Add context discovery

**Deliverables**:
- `src/core/context/locator.ts`
- Context files resolve from multiple locations

---

### Phase 6: Community Registry (Week 6)
**Goal**: shadcn-like component sharing

**Tasks**:
- Design component package format
- Implement `oac add` command
- Implement `oac publish` command
- Create community registry
- Add component validation
- Implement search and browse

**Deliverables**:
- `src/cli/commands/add.ts`
- `src/cli/commands/publish.ts`
- `src/core/registry/publisher.ts`
- `oac add agent:rust-specialist` works
- `oac publish ./my-agent` works

---

### Phase 7: Polish & Documentation (Week 7)
**Goal**: Production-ready package

**Tasks**:
- Add comprehensive error handling
- Improve CLI UX
- Write user documentation
- Create migration guide
- Update README
- Publish to npm

**Deliverables**:
- `docs/cli-reference.md`
- `docs/configuration.md`
- `docs/community-components.md`
- `docs/migration-guide.md`

---

## Community Component Guidelines

### Component Types

**Agents**: AI agent prompts for specific domains
- Example: `rust-specialist`, `python-expert`, `devops-guru`

**Skills**: Auto-invoked guidance for specific tasks
- Example: `git-workflow`, `testing-patterns`, `security-checks`

**Contexts**: Shared knowledge files
- Example: `rust-patterns`, `react-best-practices`, `api-design`

**Tools**: Custom MCP tools
- Example: `database-inspector`, `api-tester`, `log-analyzer`

---

### Publishing Requirements

**Must have**:
- ✅ Valid `oac.json` metadata
- ✅ Component file (agent.md, skill.md, etc.)
- ✅ README.md with usage instructions
- ✅ LICENSE file (MIT, Apache 2.0, etc.)
- ✅ Passes validation (`oac validate`)

**Should have**:
- ✅ Tests (smoke-test.yaml minimum)
- ✅ Examples in README
- ✅ Version history in CHANGELOG.md
- ✅ GitHub repository

**Nice to have**:
- ✅ Context files
- ✅ Multiple test cases
- ✅ Screenshots/demos
- ✅ Video tutorial

---

### Verification System

**Verified Components**: Official or community-approved
- ✅ Reviewed by maintainers
- ✅ Follows best practices
- ✅ Has comprehensive tests
- ✅ Well-documented
- ✅ Actively maintained

**Unverified Components**: Community contributions
- ⚠️ Use at your own risk
- ⚠️ May not follow best practices
- ⚠️ May have limited testing

---

## Backward Compatibility

**Preserve existing workflows**:
- ✅ Keep `install.sh` for direct usage
- ✅ Keep `bin/oac.js` as entry point
- ✅ Keep registry.json format
- ✅ Keep `.opencode/` structure
- ✅ Support legacy `oac [profile]` syntax

**Migration path**:
```bash
# Old way (still works)
npm install -g @nextsystems/oac
oac developer

# New way (enhanced)
npm install -g @nextsystems/oac
oac configure
oac install opencode
oac add agent:rust-specialist
```

---

## Success Metrics

**Must have**:
- ✅ Multi-IDE installation works
- ✅ Configuration persists
- ✅ Updates work across IDEs
- ✅ Community components can be added
- ✅ Context resolution works
- ✅ Backward compatible

**Nice to have**:
- ✅ 100+ community components
- ✅ Auto-update notifications
- ✅ IDE auto-detection
- ✅ Plugin system

---

## Related Files

**Core Concepts**:
- `core-concepts/agents.md` - Agent system
- `core-concepts/registry.md` - Registry system
- `concepts/compatibility-layer.md` - Multi-IDE support

**Guides**:
- `guides/npm-publishing.md` - Publishing workflow
- `guides/adding-agent.md` - Creating agents

**Lookup**:
- `lookup/file-locations.md` - File structure
- `lookup/compatibility-layer-structure.md` - Adapter structure

---

## Next Steps

**Immediate**:
1. ✅ Create feature branch
2. ✅ Create context file (this file)
3. Create GitHub issue for tracking
4. Set up project board

**Phase 1 Start**:
1. Set up TypeScript project structure
2. Install dependencies
3. Create configuration schema
4. Implement `oac configure` command

---

**Last Updated**: 2026-02-14  
**Version**: 1.0.0-alpha  
**Status**: Planning → Implementation
