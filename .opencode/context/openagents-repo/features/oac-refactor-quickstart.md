# OAC Package Refactor - Quick Start

**Purpose**: Quick reference for working on the OAC package refactor  
**Issue**: #206  
**Branch**: `feature/oac-package-refactor`  
**Context**: `features/oac-package-refactor.md`

---

## Current Status

✅ **Planning Complete**
- Context file created
- GitHub issue #206 created
- Feature branch created and pushed

📝 **Next: Phase 1 - Core CLI Infrastructure**

---

## Quick Commands

```bash
# Switch to feature branch
git checkout feature/oac-package-refactor

# View full context
cat .opencode/context/openagents-repo/features/oac-package-refactor.md

# View GitHub issue
gh issue view 206

# Start Phase 1
# (See Phase 1 section below)
```

---

## Phase 1: Core CLI Infrastructure

**Goal**: Set up TypeScript project and configuration system

### Tasks

1. **Set up TypeScript project structure**
   ```bash
   mkdir -p src/{cli/{commands,config},core,types,utils}
   npm install --save-dev typescript @types/node tsx vitest
   npx tsc --init
   ```

2. **Install CLI dependencies**
   ```bash
   npm install commander inquirer zod chalk ora boxen
   npm install --save-dev @types/inquirer
   ```

3. **Create configuration schema**
   - File: `src/cli/config/schema.ts`
   - Use Zod for validation
   - Define OACConfig interface

4. **Create configuration manager**
   - File: `src/cli/config/manager.ts`
   - Read/write config files
   - Merge global and local configs
   - Validate with schema

5. **Implement basic CLI commands**
   - File: `src/cli/index.ts` (Commander setup)
   - File: `src/cli/commands/configure.ts`
   - File: `src/cli/commands/list.ts`
   - File: `src/cli/commands/init.ts`

6. **Update bin/oac.js**
   - Point to compiled TypeScript
   - Handle both legacy and new commands

7. **Write tests**
   - Test configuration schema
   - Test config manager
   - Test CLI commands

### Deliverables

- [ ] TypeScript project configured
- [ ] Configuration schema defined
- [ ] Configuration manager working
- [ ] `oac configure` command works
- [ ] `oac list` command works
- [ ] `oac init` command works
- [ ] Tests passing

### Validation

```bash
# Test configuration
oac configure show
oac configure set agents.permissions.bash auto
oac configure get agents.permissions.bash

# Test list
oac list
oac list --agents

# Test init
cd /tmp/test-project
oac init developer
```

---

## Project Structure (Phase 1)

```
@nextsystems/oac/
├── bin/
│   └── oac.js                  # Updated entry point
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── configure.ts    # NEW
│   │   │   ├── list.ts         # NEW
│   │   │   └── init.ts         # NEW
│   │   ├── config/
│   │   │   ├── manager.ts      # NEW
│   │   │   ├── schema.ts       # NEW
│   │   │   └── defaults.ts     # NEW
│   │   └── index.ts            # NEW (Commander setup)
│   ├── types/
│   │   └── config.ts           # NEW
│   └── utils/
│       ├── logger.ts           # NEW
│       └── prompts.ts          # NEW
├── config/
│   └── oac.config.json         # NEW (default config)
├── tsconfig.json               # NEW
├── package.json                # UPDATED
└── .opencode/                  # EXISTING
```

---

## Configuration Schema (Reference)

```typescript
// src/cli/config/schema.ts
import { z } from 'zod';

export const OACConfigSchema = z.object({
  version: z.string(),
  preferences: z.object({
    defaultIDE: z.enum(['opencode', 'cursor', 'claude', 'windsurf']),
    installLocation: z.enum(['local', 'global']),
    autoUpdate: z.boolean(),
    updateChannel: z.enum(['stable', 'beta', 'alpha'])
  }),
  ides: z.record(z.object({
    enabled: z.boolean(),
    path: z.string(),
    profile: z.string()
  })),
  agents: z.object({
    behavior: z.object({
      approvalGates: z.boolean(),
      contextLoading: z.enum(['lazy', 'eager']),
      delegationThreshold: z.number()
    }),
    permissions: z.object({
      bash: z.enum(['approve', 'auto', 'deny']),
      write: z.enum(['approve', 'auto', 'deny']),
      edit: z.enum(['approve', 'auto', 'deny']),
      task: z.enum(['approve', 'auto', 'deny'])
    })
  }),
  context: z.object({
    locations: z.array(z.string()),
    autoDiscover: z.boolean(),
    cacheEnabled: z.boolean()
  }),
  registry: z.object({
    source: z.string().url(),
    localCache: z.string(),
    updateInterval: z.number()
  })
});

export type OACConfig = z.infer<typeof OACConfigSchema>;
```

---

## Default Configuration (Reference)

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
    },
    "claude": {
      "enabled": false,
      "path": ".claude",
      "profile": "developer"
    },
    "windsurf": {
      "enabled": false,
      "path": ".windsurf",
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
  },
  "registry": {
    "source": "https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/registry.json",
    "localCache": "~/.config/oac/registry.cache.json",
    "updateInterval": 86400
  }
}
```

---

## Testing Strategy

### Unit Tests
```typescript
// src/cli/config/manager.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigManager } from './manager';

describe('ConfigManager', () => {
  it('should load default config', async () => {
    const manager = new ConfigManager();
    const config = await manager.load();
    expect(config.version).toBe('1.0.0');
  });

  it('should validate config schema', async () => {
    const manager = new ConfigManager();
    const valid = await manager.validate(mockConfig);
    expect(valid).toBe(true);
  });

  it('should merge global and local configs', async () => {
    const manager = new ConfigManager();
    const config = await manager.load();
    expect(config.preferences.defaultIDE).toBeDefined();
  });
});
```

### Integration Tests
```bash
# Test CLI commands
npm run build
./bin/oac.js configure show
./bin/oac.js list
./bin/oac.js init developer
```

---

## Development Workflow

1. **Create feature branch** ✅
   ```bash
   git checkout feature/oac-package-refactor
   ```

2. **Set up TypeScript project**
   ```bash
   mkdir -p src/{cli/{commands,config},core,types,utils}
   npm install dependencies
   npx tsc --init
   ```

3. **Implement Phase 1 tasks**
   - Configuration schema
   - Configuration manager
   - CLI commands

4. **Write tests**
   ```bash
   npm run test
   ```

5. **Build and test locally**
   ```bash
   npm run build
   npm pack
   npm install -g ./nextsystems-oac-*.tgz
   oac configure
   ```

6. **Commit and push**
   ```bash
   git add .
   git commit -m "feat(phase1): implement core CLI infrastructure"
   git push
   ```

---

## Resources

**Context Files**:
- `features/oac-package-refactor.md` - Full feature context
- `core-concepts/registry.md` - Registry system
- `guides/npm-publishing.md` - Publishing workflow

**External Docs**:
- Commander.js: https://github.com/tj/commander.js
- Zod: https://zod.dev
- Inquirer: https://github.com/SBoudrias/Inquirer.js

**GitHub**:
- Issue: https://github.com/darrenhinde/OpenAgentsControl/issues/206
- Branch: `feature/oac-package-refactor`

---

## Next Phase Preview

**Phase 2: Registry & Component Management**
- Port registry validation to TypeScript
- Implement registry loader/resolver
- Create component installer
- Profile installer
- Dependency resolution

---

**Last Updated**: 2026-02-14  
**Status**: Ready to start Phase 1
