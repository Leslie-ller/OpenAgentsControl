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
- ✅ **CRITICAL**: User runs in project root, chooses local or global install, always confirms overwrites (unless YOLO mode)

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

**Configuration File**: `~/.config/oac/config.json` (global) or `.oac/config.json` (local/project)

**CRITICAL BEHAVIOR**:
- User runs `oac` commands in their project root directory
- Always asks: "Install locally (this project) or globally?"
- Always confirms before overwriting files (unless `--yolo` flag)
- YOLO mode (`--yolo`): Auto-confirms all, reports changes at end
- Default mode: Interactive approval for every file conflict

```json
{
  "version": "1.0.0",
  "preferences": {
    "defaultIDE": "opencode",
    "installLocation": "local",
    "autoUpdate": false,
    "updateChannel": "stable",
    "confirmOverwrites": true,
    "yoloMode": false
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

### 3. User Approval & YOLO Mode (CRITICAL)

**Goal**: User maintains full control over their project, with optional fast mode

**Default Behavior: Interactive Approval**

Every operation that modifies files asks for confirmation:

```bash
# User runs in project root
cd ~/my-project
oac install opencode

# OAC asks:
? Install location:
  > Local (this project: ~/my-project/.opencode)
    Global (~/.config/oac)

# User selects "Local"

# OAC shows what will be installed:
📦 Installing OpenCode Developer Profile
  
  Will create/modify:
  ✓ .opencode/agent/core/openagent.md
  ✓ .opencode/agent/core/opencoder.md
  ⚠ .opencode/agent/TestEngineer.md (exists - will overwrite)
  ✓ .opencode/context/core/standards/code-quality.md
  ✓ .opencode/config.json
  
  Total: 15 files (2 new, 12 updated, 1 conflict)

? Proceed with installation? (Y/n)

# If conflicts exist:
⚠ File exists: .opencode/agent/TestEngineer.md
  
  Current: 245 lines, modified 2 days ago
  New:     312 lines, version 0.8.0
  
? What would you like to do?
  > Skip (keep existing)
    Overwrite (replace with new)
    Backup (save as .bak, install new)
    Diff (show changes)
    Skip all conflicts
    Overwrite all conflicts
```

**YOLO Mode: Fast & Furious**

Skip all confirmations, auto-resolve conflicts, report at end:

```bash
# Enable YOLO mode
oac install opencode --yolo

# Or set in config
oac configure set preferences.yoloMode true

# YOLO mode behavior:
📦 Installing OpenCode Developer Profile (YOLO MODE)
  
  ⚡ Auto-confirming all operations...
  ✓ Created .opencode/agent/core/openagent.md
  ✓ Created .opencode/agent/core/opencoder.md
  ⚠ Overwrote .opencode/agent/TestEngineer.md (backed up to .bak)
  ✓ Created .opencode/context/core/standards/code-quality.md
  ✓ Created .opencode/config.json
  
  ✅ Installation complete!
  
  📊 Summary:
  - 13 files created
  - 2 files overwritten (backups in .opencode/.backups/)
  - 0 files skipped
  - Total time: 1.2s
  
  ⚠ Review changes: git diff
```

**Conflict Resolution Strategies**

```typescript
enum ConflictStrategy {
  ASK = 'ask',           // Ask user for each conflict (default)
  SKIP = 'skip',         // Skip all conflicts, keep existing
  OVERWRITE = 'overwrite', // Overwrite all conflicts
  BACKUP = 'backup',     // Backup existing, install new
  YOLO = 'yolo'          // Auto-resolve (backup + overwrite)
}
```

**Configuration**

```json
{
  "preferences": {
    "confirmOverwrites": true,
    "yoloMode": false,
    "conflictStrategy": "ask",
    "autoBackup": true,
    "backupLocation": ".opencode/.backups"
  }
}
```

**Commands with Approval Control**

```bash
# Interactive (default)
oac install opencode
oac update
oac add agent:rust-specialist

# YOLO mode (skip confirmations)
oac install opencode --yolo
oac update --yolo
oac add agent:rust-specialist --yolo

# Force overwrite (no backups)
oac install opencode --force

# Skip conflicts (keep existing)
oac install opencode --skip-existing

# Dry run (show what would happen)
oac install opencode --dry-run
```

**Safety Features**

- ✅ Always create backups before overwriting (unless `--force`)
- ✅ Show diff before overwriting
- ✅ Maintain backup history in `.opencode/.backups/`
- ✅ Git integration: detect uncommitted changes, warn user
- ✅ Rollback support: `oac rollback` to undo last operation
- ✅ Audit log: `.oac/audit.log` tracks all operations

**Example: Full Interactive Flow**

```bash
cd ~/my-awesome-project
oac install opencode

# Step 1: Location
? Install location:
  > Local (this project: ~/my-awesome-project/.opencode)
    Global (~/.config/oac)

# Step 2: Profile
? Select profile:
  > developer (Full development setup)
    essential (Minimal setup)
    business (Content and product focus)
    custom (Choose components)

# Step 3: Review
📦 Installing OpenCode Developer Profile
  
  Will install to: ~/my-awesome-project/.opencode
  
  Components:
  - 2 core agents (openagent, opencoder)
  - 8 subagents (tester, reviewer, coder-agent, ...)
  - 7 commands (commit, test, context, ...)
  - 15 context files
  
  Total size: ~2.5 MB

? Proceed? (Y/n) y

# Step 4: Conflict Resolution (if any)
⚠ 3 files already exist:
  
  1. .opencode/agent/TestEngineer.md
     Current: 245 lines, modified 2 days ago
     New:     312 lines, version 0.8.0
     
? Action:
  > Backup and overwrite
    Skip (keep existing)
    Show diff
    
# Step 5: Installation
⚡ Installing...
  ✓ Created .opencode/agent/core/openagent.md
  ✓ Created .opencode/agent/core/opencoder.md
  ⚠ Backed up .opencode/agent/TestEngineer.md → .backups/TestEngineer.md.2026-02-14
  ✓ Overwrote .opencode/agent/TestEngineer.md
  ...
  
# Step 6: Summary
✅ Installation complete!

📊 Summary:
- 13 files created
- 2 files updated
- 3 files backed up
- 0 files skipped

📁 Installed to: ~/my-awesome-project/.opencode

🔍 Next steps:
  1. Review changes: git diff
  2. Test setup: oac doctor
  3. Configure: oac configure
  
💡 Tip: Use 'oac --yolo' to skip confirmations next time
```

---

### 4. Community Component Registry (shadcn-like)

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

### 4. Context Resolution System (CRITICAL)

**Goal**: Intelligent context resolution for agents running locally or globally

**The Problem**:
- Agents can run from **global install** (`~/.config/oac/`) or **local install** (`./opencode/`)
- Context files exist in **project-specific** locations AND **global** locations
- Need to resolve: "Which context file should the agent use?"
- User preferences (global) vs project requirements (local)

**The Solution: Layered Context Resolution**

#### Context Layers (Priority Order)

```
1. PROJECT OVERRIDE    (./.oac/context/)           [Highest Priority]
   ↓ User's project-specific overrides
   
2. PROJECT CONTEXT     (./.opencode/context/)
   ↓ Project-specific context files
   
3. IDE CONTEXT         (./.cursor/context/, ./.claude/context/)
   ↓ IDE-specific context (if different IDE)
   
4. PROJECT DOCS        (./docs/, ./docs/context/)
   ↓ Project documentation
   
5. USER GLOBAL         (~/.config/oac/context/)
   ↓ User's personal preferences/standards
   
6. OAC GLOBAL          (~/.config/oac/official/)   [Lowest Priority]
   ↓ Official OAC context files
```

#### Resolution Algorithm

```typescript
class ContextResolver {
  async resolve(ref: string, options: ResolveOptions): Promise<string | null> {
    const { 
      agentLocation,  // 'global' | 'local'
      projectRoot,    // Current working directory
      preferLocal     // User preference
    } = options;
    
    // Build search paths based on agent location and preferences
    const searchPaths = this.buildSearchPaths(agentLocation, projectRoot, preferLocal);
    
    // Search in priority order
    for (const basePath of searchPaths) {
      const fullPath = path.join(basePath, ref);
      if (await fs.pathExists(fullPath)) {
        return fullPath;
      }
    }
    
    return null; // Not found
  }
  
  private buildSearchPaths(
    agentLocation: 'global' | 'local',
    projectRoot: string,
    preferLocal: boolean
  ): string[] {
    const paths: string[] = [];
    
    // If agent is running locally OR user prefers local context
    if (agentLocation === 'local' || preferLocal) {
      // Prioritize project context
      paths.push(
        path.join(projectRoot, '.oac/context'),        // Project override
        path.join(projectRoot, '.opencode/context'),   // Project context
        path.join(projectRoot, '.cursor/context'),     // IDE context
        path.join(projectRoot, '.claude/context'),
        path.join(projectRoot, 'docs/context'),        // Project docs
        path.join(projectRoot, 'docs')
      );
    }
    
    // Always include global context (fallback)
    paths.push(
      path.join(os.homedir(), '.config/oac/context'),     // User global
      path.join(os.homedir(), '.config/oac/official')     // OAC official
    );
    
    // If agent is running globally AND user prefers global
    if (agentLocation === 'global' && !preferLocal) {
      // Reverse priority: global first, then project
      return [
        path.join(os.homedir(), '.config/oac/context'),
        path.join(os.homedir(), '.config/oac/official'),
        ...paths.slice(0, -2) // Add project paths after global
      ];
    }
    
    return paths;
  }
}
```

#### Configuration

```json
{
  "context": {
    "resolution": {
      "preferLocal": true,           // Prefer project context over global
      "allowOverrides": true,        // Allow .oac/context/ overrides
      "fallbackToGlobal": true,      // Fall back to global if not found locally
      "cacheResolution": true        // Cache resolved paths
    },
    "locations": {
      "project": [
        ".oac/context",              // Project overrides (highest priority)
        ".opencode/context",         // Project context
        ".cursor/context",           // IDE-specific
        ".claude/context",
        "docs/context",              // Project docs
        "docs"
      ],
      "global": [
        "~/.config/oac/context",     // User global context
        "~/.config/oac/official"     // OAC official context
      ]
    },
    "autoDiscover": true,
    "validation": {
      "warnOnMissing": true,
      "errorOnMissing": false,
      "suggestAlternatives": true
    }
  }
}
```

#### Example Scenarios

**Scenario 1: Agent runs locally, context exists in project**

```bash
# User is in project directory
cd ~/my-project

# Agent runs locally
oac install opencode --local

# Agent needs: 'core/standards/code-quality.md'
# Resolution:
# 1. Check: ~/my-project/.oac/context/core/standards/code-quality.md ❌
# 2. Check: ~/my-project/.opencode/context/core/standards/code-quality.md ✅
# → Uses project-specific context
```

**Scenario 2: Agent runs globally, no project context**

```bash
# User is in project directory
cd ~/my-project

# Agent runs from global install
oac install opencode --global

# Agent needs: 'core/standards/code-quality.md'
# Resolution:
# 1. Check: ~/.config/oac/context/core/standards/code-quality.md ✅
# → Uses global context
```

**Scenario 3: Project override**

```bash
# User wants custom code quality standards for this project
mkdir -p ~/my-project/.oac/context/core/standards
cp ~/.config/oac/official/core/standards/code-quality.md \
   ~/my-project/.oac/context/core/standards/code-quality.md

# Edit project-specific version
vim ~/my-project/.oac/context/core/standards/code-quality.md

# Agent needs: 'core/standards/code-quality.md'
# Resolution:
# 1. Check: ~/my-project/.oac/context/core/standards/code-quality.md ✅
# → Uses project override (highest priority)
```

**Scenario 4: Mixed context (project + global)**

```bash
# Project has some context
~/my-project/.opencode/context/
  └── project/
      └── architecture.md

# Global has standard context
~/.config/oac/official/
  └── core/
      └── standards/
          └── code-quality.md

# Agent needs both:
# - 'project/architecture.md' → Found in project ✅
# - 'core/standards/code-quality.md' → Falls back to global ✅
```

#### Context Merging (Advanced)

For certain context types, we can **merge** instead of override:

```typescript
interface ContextMergeStrategy {
  type: 'override' | 'merge' | 'append';
  mergeKey?: string; // For merge strategy
}

// Example: Merge project and global standards
const merged = await contextResolver.resolveWithMerge(
  'core/standards/code-quality.md',
  {
    strategy: 'merge',
    mergeKey: 'standards', // Merge 'standards' sections
    preferLocal: true      // Local takes precedence on conflicts
  }
);

// Result:
// - Global standards: base rules
// - Project standards: additional/override rules
// - Final: combined ruleset
```

#### CLI Commands for Context Management

```bash
# Show context resolution for a reference
oac context resolve 'core/standards/code-quality.md'
  → Resolved to: ~/my-project/.opencode/context/core/standards/code-quality.md
  → Source: project
  → Fallbacks checked: 2

# List all available context files
oac context list
  --local                       # Project context only
  --global                      # Global context only
  --all                         # All (default)
  --tree                        # Show as tree

# Validate context references
oac context validate
  → Checking 45 context references...
  ✓ 42 resolved
  ⚠ 3 missing (using fallbacks)
  
# Create project override
oac context override 'core/standards/code-quality.md'
  → Copied from: ~/.config/oac/official/core/standards/code-quality.md
  → To: ~/my-project/.oac/context/core/standards/code-quality.md
  → Edit this file to customize for your project

# Show context sources
oac context sources
  Project Context:
    .oac/context/              (2 files)
    .opencode/context/         (15 files)
    docs/                      (8 files)
  
  Global Context:
    ~/.config/oac/context/     (5 files)
    ~/.config/oac/official/    (42 files)
  
  Total: 72 context files

# Sync global context to project
oac context sync --to-project
  → Copying global context to project...
  ✓ Copied 42 files to .opencode/context/

# Sync project context to global
oac context sync --to-global
  → Copying project context to global...
  ⚠ This will affect all projects using global context
  ? Proceed? (y/N)
```

#### Agent Context Loading

Agents need to know where they're running from:

```typescript
// In agent prompt or configuration
class AgentContext {
  location: 'global' | 'local';
  projectRoot: string | null;
  contextResolver: ContextResolver;
  
  async loadContext(ref: string): Promise<string> {
    const resolved = await this.contextResolver.resolve(ref, {
      agentLocation: this.location,
      projectRoot: this.projectRoot || process.cwd(),
      preferLocal: true
    });
    
    if (!resolved) {
      throw new Error(`Context not found: ${ref}`);
    }
    
    return fs.readFile(resolved, 'utf-8');
  }
}
```

#### Environment Variables

```bash
# Override context resolution behavior
OAC_CONTEXT_PREFER_LOCAL=true        # Prefer project context
OAC_CONTEXT_PREFER_GLOBAL=true       # Prefer global context
OAC_CONTEXT_PROJECT_ROOT=/path/to/project
OAC_CONTEXT_GLOBAL_ROOT=~/.config/oac
OAC_CONTEXT_CACHE_ENABLED=true
OAC_CONTEXT_VALIDATION=strict        # strict | warn | off
```

#### Visual Representation

```
Agent Running Locally (in ~/my-project):
┌─────────────────────────────────────────┐
│ Agent: openagent (local)                │
│ Working Dir: ~/my-project               │
└─────────────────────────────────────────┘
              ↓
    Needs: 'core/standards/code-quality.md'
              ↓
┌─────────────────────────────────────────┐
│ Context Resolver                        │
│ Mode: preferLocal = true                │
└─────────────────────────────────────────┘
              ↓
    Search Priority:
    1. ~/my-project/.oac/context/... ❌
    2. ~/my-project/.opencode/context/... ✅ FOUND
    3. (skip remaining)
              ↓
    Returns: ~/my-project/.opencode/context/core/standards/code-quality.md


Agent Running Globally:
┌─────────────────────────────────────────┐
│ Agent: openagent (global)               │
│ Working Dir: ~/my-project               │
└─────────────────────────────────────────┘
              ↓
    Needs: 'core/standards/code-quality.md'
              ↓
┌─────────────────────────────────────────┐
│ Context Resolver                        │
│ Mode: preferLocal = true (default)      │
└─────────────────────────────────────────┘
              ↓
    Search Priority:
    1. ~/my-project/.oac/context/... ❌
    2. ~/my-project/.opencode/context/... ❌
    3. ~/.config/oac/context/... ❌
    4. ~/.config/oac/official/... ✅ FOUND
              ↓
    Returns: ~/.config/oac/official/core/standards/code-quality.md
```

#### Best Practices

**For Users**:
- ✅ Use global context for personal coding standards
- ✅ Use project context for project-specific requirements
- ✅ Use `.oac/context/` for temporary overrides
- ✅ Keep project context in version control
- ✅ Keep global context private (personal preferences)

**For Projects**:
- ✅ Include essential context in `.opencode/context/`
- ✅ Document required context files in README
- ✅ Use `oac context validate` in CI/CD
- ✅ Provide `.oac/context/` examples for common overrides

**For OAC**:
- ✅ Ship official context in `~/.config/oac/official/`
- ✅ Never modify user's global context without permission
- ✅ Warn when context is missing
- ✅ Suggest alternatives when context not found

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

### 5. IDE Feature Parity & Capacity Management (CRITICAL)

**Goal**: Support different feature sets per IDE based on their capabilities

**The Problem**:
- Different IDEs support different features
- OpenCode and Claude Code: Full feature support (agents, skills, context, plugins, tools)
- Cursor: Limited (single .cursorrules file, no skills/plugins)
- Windsurf: Partial support
- Need to gracefully handle unsupported features

**Feature Support Matrix**:

```typescript
interface IDECapabilities {
  id: string;
  name: string;
  features: {
    multipleAgents: boolean;
    skills: boolean;
    plugins: boolean;
    tools: boolean;
    contexts: boolean;
    commands: boolean;
    granularPermissions: boolean;
    hooks: boolean;
  };
  limits?: {
    maxAgents?: number;
    maxFileSize?: number;
    maxContextFiles?: number;
  };
}

const IDE_CAPABILITIES: Record<string, IDECapabilities> = {
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    features: {
      multipleAgents: true,
      skills: true,
      plugins: true,
      tools: true,
      contexts: true,
      commands: true,
      granularPermissions: true,
      hooks: true
    }
    // No limits - full support
  },
  
  claude: {
    id: 'claude',
    name: 'Claude Code',
    features: {
      multipleAgents: true,
      skills: true,
      plugins: true,
      tools: true,
      contexts: true,
      commands: false,
      granularPermissions: false,
      hooks: true
    }
    // Full support except commands and granular permissions
  },
  
  cursor: {
    id: 'cursor',
    name: 'Cursor IDE',
    features: {
      multipleAgents: false,  // Single .cursorrules file
      skills: false,
      plugins: false,
      tools: false,
      contexts: true,         // Embedded in .cursorrules
      commands: false,
      granularPermissions: false,
      hooks: false
    },
    limits: {
      maxAgents: 1,           // Merge all agents into one
      maxFileSize: 100000     // ~100KB limit for .cursorrules
    }
  },
  
  windsurf: {
    id: 'windsurf',
    name: 'Windsurf',
    features: {
      multipleAgents: true,
      skills: false,
      plugins: false,
      tools: false,
      contexts: true,
      commands: false,
      granularPermissions: false,
      hooks: false
    },
    limits: {
      maxAgents: 10
    }
  }
};
```

**Feature Detection & Warnings**:

```bash
# User tries to install skill for Cursor
oac install cursor --profile developer

⚠ Feature Compatibility Warning:
  
  IDE: Cursor
  Profile: developer
  
  Unsupported features in this profile:
  ❌ Skills (8 skills will be skipped)
  ❌ Plugins (2 plugins will be skipped)
  ❌ Commands (7 commands will be skipped)
  ⚠ Multiple agents (2 agents will be merged into .cursorrules)
  
  Supported features:
  ✓ Agents (will merge into single .cursorrules)
  ✓ Contexts (will embed in .cursorrules)
  
? How would you like to proceed?
  > Continue with supported features only
    Cancel installation
    Show detailed compatibility report
    Create custom profile for Cursor

# Detailed compatibility report
oac compatibility cursor --profile developer

IDE Compatibility Report: Cursor
Profile: developer

┌─────────────────────┬──────────┬────────────────────────┐
│ Feature             │ Status   │ Action                 │
├─────────────────────┼──────────┼────────────────────────┤
│ Agents (2)          │ ⚠ Merge  │ Combine into .cursorrules │
│ Subagents (8)       │ ⚠ Merge  │ Combine into .cursorrules │
│ Skills (8)          │ ❌ Skip   │ Not supported          │
│ Plugins (2)         │ ❌ Skip   │ Not supported          │
│ Commands (7)        │ ❌ Skip   │ Not supported          │
│ Contexts (15)       │ ✓ Embed  │ Embed in .cursorrules  │
│ Tools (3)           │ ❌ Skip   │ Not supported          │
└─────────────────────┴──────────┴────────────────────────┘

Estimated .cursorrules size: 45KB (within 100KB limit)

Recommendations:
• Use OpenCode or Claude Code for full feature support
• Create Cursor-specific profile with essential agents only
• Consider using oac create profile --for cursor
```

**Adaptive Installation**:

```typescript
class AdaptiveInstaller {
  async install(ide: string, profile: string, options: InstallOptions) {
    const capabilities = IDE_CAPABILITIES[ide];
    const components = await this.loadProfile(profile);
    
    // Filter components based on IDE capabilities
    const supported = this.filterByCapabilities(components, capabilities);
    const unsupported = components.filter(c => !supported.includes(c));
    
    // Warn user about unsupported features
    if (unsupported.length > 0 && !options.yolo) {
      const proceed = await this.warnUnsupportedFeatures(
        ide,
        supported,
        unsupported,
        capabilities
      );
      
      if (!proceed) {
        return { cancelled: true };
      }
    }
    
    // Apply transformations for IDE-specific limitations
    const transformed = await this.transformForIDE(supported, capabilities);
    
    // Install
    return this.installComponents(transformed, ide, options);
  }
  
  private filterByCapabilities(
    components: Component[],
    capabilities: IDECapabilities
  ): Component[] {
    return components.filter(component => {
      switch (component.type) {
        case 'agent':
        case 'subagent':
          return capabilities.features.multipleAgents || 
                 components.filter(c => c.type === 'agent').length === 1;
        case 'skill':
          return capabilities.features.skills;
        case 'plugin':
          return capabilities.features.plugins;
        case 'tool':
          return capabilities.features.tools;
        case 'context':
          return capabilities.features.contexts;
        case 'command':
          return capabilities.features.commands;
        default:
          return false;
      }
    });
  }
  
  private async transformForIDE(
    components: Component[],
    capabilities: IDECapabilities
  ): Promise<Component[]> {
    // Special handling for Cursor: merge all agents
    if (capabilities.id === 'cursor') {
      const agents = components.filter(c => c.type === 'agent' || c.type === 'subagent');
      const contexts = components.filter(c => c.type === 'context');
      
      // Merge agents into single .cursorrules
      const merged = await this.mergeAgentsForCursor(agents, contexts);
      
      return [merged];
    }
    
    return components;
  }
}
```

**IDE-Specific Profiles**:

```bash
# Create profile optimized for specific IDE
oac create profile --for cursor --name cursor-essentials

? Select components for Cursor profile:
  Agents (select up to 3 - will be merged):
  ✓ openagent
  ✓ opencoder
  ✓ frontend-specialist
  
  Contexts (will be embedded):
  ✓ core/standards/code-quality
  ✓ development/react-patterns
  
  ⚠ Skills, plugins, and commands are not supported by Cursor

✓ Created profile: cursor-essentials
✓ Estimated .cursorrules size: 32KB
✓ Compatible with Cursor IDE

# List IDE-specific profiles
oac profiles --for cursor
  cursor-essentials
  cursor-minimal
  cursor-frontend

# Install IDE-specific profile
oac install cursor --profile cursor-essentials
```

**Component Creation with IDE Support**:

```bash
# Create component with IDE compatibility info
oac create agent rust-specialist

? Which IDEs should support this agent?
  ✓ OpenCode (full support)
  ✓ Claude Code (full support)
  ✓ Cursor (will be merged with other agents)
  ✓ Windsurf (full support)

? Agent size optimization:
  > Standard (no optimization)
    Compact (optimize for Cursor's file size limit)
    Minimal (essential instructions only)

✓ Created agent with multi-IDE support
✓ Estimated sizes:
  - OpenCode: 15KB (standalone)
  - Claude Code: 15KB (standalone)
  - Cursor: +15KB (merged into .cursorrules)
  - Windsurf: 15KB (standalone)
```

**Capacity Warnings**:

```bash
# Installing too many components for Cursor
oac install cursor --profile developer

⚠ Capacity Warning:
  
  IDE: Cursor
  Limit: 100KB for .cursorrules
  
  Current profile size: 125KB
  ❌ Exceeds limit by 25KB
  
? How would you like to proceed:
  > Remove optional components (interactive)
    Use compact mode (reduce file sizes)
    Create custom profile
    Cancel installation

# Interactive component selection
? Select components to include (max 100KB):
  
  Core (required):
  ✓ openagent (12KB)
  ✓ opencoder (15KB)
  
  Specialists (optional):
  ✓ frontend-specialist (18KB)
  ✓ devops-specialist (16KB)
  ☐ data-analyst (14KB)
  ☐ copywriter (12KB)
  
  Contexts:
  ✓ core/standards (8KB)
  ✓ development/patterns (12KB)
  
  Current: 81KB / 100KB
  Remaining: 19KB
```

**CLI Commands for IDE Management**:

```bash
# Check IDE compatibility
oac compatibility <ide>
  --profile <profile>           # Check profile compatibility
  --component <component>       # Check component compatibility

# List supported IDEs
oac ides
  --features                    # Show feature matrix
  --limits                      # Show capacity limits

# Show IDE capabilities
oac ide info <ide>
  → Shows full feature support matrix

# Optimize for IDE
oac optimize --for <ide>
  → Optimizes current installation for IDE
  → Removes unsupported features
  → Compacts files if needed

# Validate IDE installation
oac validate --ide <ide>
  → Checks if installation is valid for IDE
  → Warns about unsupported features
  → Checks capacity limits
```

**Configuration**:

```json
{
  "ides": {
    "opencode": {
      "enabled": true,
      "path": ".opencode",
      "profile": "developer",
      "features": "all"
    },
    "cursor": {
      "enabled": true,
      "path": ".cursor",
      "profile": "cursor-essentials",
      "features": "auto-detect",
      "optimization": {
        "mergeAgents": true,
        "embedContexts": true,
        "compactMode": true,
        "maxFileSize": 100000
      }
    },
    "claude": {
      "enabled": true,
      "path": ".claude",
      "profile": "developer",
      "features": "all"
    }
  },
  "compatibility": {
    "warnUnsupported": true,
    "autoOptimize": false,
    "strictMode": false
  }
}
```

**Best Practices**:

**For Full Features** (OpenCode, Claude Code):
- ✅ Use standard profiles (developer, business, etc.)
- ✅ Install all component types
- ✅ No optimization needed

**For Limited IDEs** (Cursor):
- ✅ Create IDE-specific profiles
- ✅ Keep agent count low (1-3 agents)
- ✅ Use compact mode
- ✅ Embed contexts instead of separate files
- ✅ Monitor file size limits

**For All IDEs**:
- ✅ Check compatibility before installing: `oac compatibility <ide>`
- ✅ Use `--dry-run` to preview changes
- ✅ Create custom profiles for specific needs
- ✅ Validate after installation: `oac validate --ide <ide>`

---

## CLI Commands Reference

**CRITICAL**: All commands run in project root directory. User chooses local (project) or global install.

### Installation & Setup

```bash
# Initialize OAC in current directory (interactive)
oac init [profile]
  --local                       # Force local install (./opencode)
  --global                      # Force global install (~/.config/oac)
  --yolo                        # Skip all confirmations
  --dry-run                     # Show what would happen

# Install for specific IDE (asks local/global)
oac install [ide]
  --local                       # Install to current directory
  --global                      # Install to global config
  --profile <name>              # Use specific profile
  --yolo                        # Auto-confirm all
  --skip-existing               # Skip conflicts, keep existing
  --force                       # Overwrite all, no backups
  --dry-run                     # Preview changes

# Configure OAC settings
oac configure
  set <key> <value>             # Set config value
  get <key>                     # Get config value
  show                          # Show all config
  reset                         # Reset to defaults
```

### Component Management

```bash
# Add component from registry (asks local/global)
oac add <component>
  --local                       # Add to current project
  --global                      # Add to global config
  --yolo                        # Auto-confirm
  --dry-run                     # Preview

# Remove component
oac remove <component>
  --local                       # Remove from current project
  --global                      # Remove from global
  --yolo                        # Auto-confirm

# List installed components
oac list [--type]
  --local                       # List local components
  --global                      # List global components
  --agents                      # List agents only
  --skills                      # List skills only
  --contexts                    # List contexts only

# Search registry
oac search <query>
  --type <type>                 # Filter by type
  --verified                    # Verified only

# Browse available components
oac browse [type]
  --verified                    # Verified only
  --community                   # Community only
```

### Updates & Sync

```bash
# Update components (asks which to update)
oac update [options]
  --check                       # Check for updates only
  --all                         # Update all components
  --local                       # Update local install
  --global                      # Update global install
  --claude                      # Apply to Claude Code
  --opencode                    # Apply to OpenCode
  --yolo                        # Auto-confirm all
  --dry-run                     # Preview updates

# Apply config to IDE (asks for confirmation)
oac apply [ide]
  --all                         # Apply to all configured IDEs
  --yolo                        # Auto-confirm
  --force                       # Overwrite all
  --dry-run                     # Preview

# Sync across all IDEs
oac sync
  --yolo                        # Auto-confirm
  --dry-run                     # Preview
```

### Creation & Scaffolding (Interactive)

```bash
# Interactive component creation wizard
oac create
  ? What would you like to create?
    > Agent
      Skill
      Context
      Plugin
      Command
      Tool
  
  ? Component type:
    > agent
      subagent
  
  ? Name: rust-specialist
  ? Description: Expert in Rust programming
  ? Category: development
  
  ✓ Created .opencode/agent/development/rust-specialist.md
  ✓ Created tests/smoke-test.yaml
  ✓ Added to registry
  
  Next steps:
  1. Edit agent prompt
  2. Add tests
  3. Test: oac test agent:rust-specialist

# Create specific component types
oac create agent [name]
  --category <category>         # Agent category
  --template <template>         # Use template
  --with-tests                  # Include test scaffold
  --interactive                 # Interactive wizard (default)

oac create skill [name]
  --trigger <pattern>           # Skill trigger pattern
  --template <template>

oac create context [name]
  --category <category>
  --template <template>

oac create plugin [name]
  --type <type>                 # Plugin type

# List available templates
oac templates
  --type <type>                 # Filter by type
  
# Use template
oac create agent --template specialist
  → Uses specialist agent template
```

### Publishing (Community)

```bash
# Publish component to registry
oac publish <path>
  --type <type>                 # Component type
  --dry-run                     # Validate only

# Remove from registry
oac unpublish <component>

# Validate component package
oac validate <path>
```

### Utilities

```bash
# Check installation health
oac doctor
  --local                       # Check local install
  --global                      # Check global install
  --fix                         # Auto-fix issues (asks confirmation)

# Clean cache and temp files
oac clean
  --cache                       # Clean cache only
  --backups                     # Clean backups only
  --all                         # Clean everything
  --yolo                        # Auto-confirm

# Rollback last operation
oac rollback
  --steps <n>                   # Rollback n operations
  --to <timestamp>              # Rollback to timestamp

# Show version info
oac version
  --check                       # Check for updates

# Show help
oac help [command]
```

### Global Flags (All Commands)

```bash
--yolo                          # Skip all confirmations, auto-resolve conflicts
--dry-run                       # Show what would happen, don't execute
--verbose                       # Show detailed output
--quiet                         # Minimal output
--no-color                      # Disable colors
--json                          # Output as JSON
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
