# OAC Package Refactor - Planning Index

**Date**: 2026-02-14  
**Status**: Comprehensive Planning Phase  
**Branch**: `feature/oac-package-refactor`  
**Issue**: #206

---

## 📁 Planning Documents

### Core Planning

1. **01-main-plan.md** (62KB)
   - Complete feature specification
   - 7-phase implementation plan
   - All critical features documented
   - CLI commands reference
   - Configuration schemas
   - Examples and best practices

2. **02-quickstart-guide.md** (12KB)
   - Quick reference for Phase 1
   - Task breakdown
   - Validation steps
   - Testing strategy
   - Development workflow

3. **03-critical-feedback.md** (14KB)
   - Parallel agent review findings
   - Critical additions required
   - Approaches to rethink
   - Repository structure recommendations
   - Community contribution workflow

### User Scenario Analysis (Coming)

4. **04-solo-developer-scenarios.md**
   - Individual developer workflows
   - Pain points and solutions
   - Key experiences
   - Edge cases

5. **05-team-lead-scenarios.md**
   - Team management workflows
   - Standardization needs
   - Collaboration features
   - Governance requirements

6. **06-enterprise-scenarios.md**
   - Large organization needs
   - Security and compliance
   - Policy enforcement
   - Audit trails

7. **07-content-creator-scenarios.md**
   - Non-technical user workflows
   - Simplified interfaces
   - Template-based workflows
   - Onboarding needs

8. **08-open-source-maintainer-scenarios.md**
   - Community management
   - Contribution workflows
   - Quality control
   - Documentation needs

### Architecture & System Design

9. **09-SYNTHESIS.md** (14KB)
   - Consolidated findings from all scenarios
   - Common patterns identified
   - Feature prioritization

10. **10-FINAL-REVIEW.md** (5KB)
    - Final review and sign-off
    - Implementation readiness

11. **11-json-config-system.md** (NEW - 85KB)
    - **JSON-based agent configuration system**
    - Single source of truth architecture
    - Multi-IDE conversion system
    - Type-safe configuration with TypeScript
    - Schema validation and versioning
    - Migration path from markdown to JSON
    - 6-week implementation plan

---

## 🎯 Planning Objectives

### Phase 1: Core Planning (Complete)
- ✅ Define vision and goals
- ✅ Design architecture
- ✅ Identify critical features
- ✅ Get expert feedback
- ✅ Add customization system

### Phase 2: User Scenario Analysis (In Progress)
- ⬜ Analyze solo developer workflows
- ⬜ Analyze team workflows
- ⬜ Analyze enterprise workflows
- ⬜ Analyze content creator workflows
- ⬜ Analyze open source maintainer workflows

### Phase 3: Synthesis & Refinement (Next)
- ⬜ Consolidate findings
- ⬜ Identify common patterns
- ⬜ Resolve conflicts
- ⬜ Finalize feature set
- ⬜ Update implementation plan

---

## 📊 Key Features Summary

### Critical Features (Must Have v1.0)

1. **User Approval System**
   - Interactive approval for all file operations
   - YOLO mode for power users
   - Conflict resolution strategies
   - Backup and rollback support

2. **Context Resolution**
   - 6-layer priority system
   - Smart resolution based on agent location
   - Project override support
   - Fallback strategies

3. **Multi-IDE Support**
   - OpenCode (full support)
   - Claude Code (full support)
   - Cursor (limited, optimized)
   - Windsurf (partial support)
   - Feature parity matrix
   - Adaptive installation

4. **Agent Customization**
   - Personal presets
   - Safe editing workflow
   - Update management with merge
   - Preset sharing
   - In-place editing (advanced)

5. **Discovery & Browse**
   - Interactive TUI browser
   - Search functionality
   - Component info
   - Preview mode

6. **Security & Verification**
   - Component signing
   - Checksum verification
   - Malware scanning
   - Secret detection
   - Permission system

7. **Lockfile & Reproducibility**
   - Version locking
   - Frozen installs
   - Dependency resolution
   - Conflict detection

8. **Interactive Onboarding**
   - First-time setup wizard
   - Smart defaults
   - Use case detection
   - IDE detection

9. **Component Creation**
   - Interactive wizard
   - Template system
   - Auto-scaffolding
   - Multi-IDE support

10. **Community Registry**
    - shadcn-like model
    - Component marketplace
    - Ratings and reviews
    - Verified publishers

---

## 🏗️ Architecture Summary

### Repository Structure (Monorepo)

```
@nextsystems/oac/
├── packages/
│   ├── core/          # Core CLI
│   ├── adapters/      # IDE adapters
│   ├── registry/      # Registry management
│   ├── security/      # Security scanning
│   └── cli/           # CLI entry point
├── .opencode/         # Official components
├── registry.json
└── pnpm-workspace.yaml
```

### Configuration Layers

```
1. Project Override    (./.oac/context/)      [Highest]
2. Project Context     (./.opencode/context/)
3. IDE Context         (./.cursor/context/)
4. Project Docs        (./docs/context/)
5. User Global         (~/.config/oac/context/)
6. OAC Official        (~/.config/oac/official/) [Lowest]
```

### Preset System

```
~/.config/oac/
├── presets/
│   ├── agents/
│   │   ├── my-openagent.md
│   │   └── my-opencoder.md
│   └── .presets.json
```

---

## 📋 Implementation Phases

### Phase 1: Core CLI Infrastructure (Week 1)
- TypeScript project setup
- Configuration system (global + local)
- Approval system (interactive + YOLO)
- Context resolver (6-layer)
- Discovery (browse, search)
- Security (verify, checksum)
- Onboarding (interactive init)
- Progress UI (spinners, bars)

### Phase 2: Registry & Components (Week 2)
- Registry loader/resolver
- Component installer
- Profile installer
- Lockfile generation
- Version conflict detection
- Semver support

### Phase 3: IDE Adapters (Week 3)
- Integrate compatibility layer
- IDE-specific installers
- Feature parity system
- Apply command
- Preset system

### Phase 4: Update System (Week 4)
- Version checker
- Update fetcher/applier
- Update command
- Preset merge strategies

### Phase 5: Context System (Week 5)
- Context locator service
- Multi-location resolution
- Validation
- Composition (not merging)

### Phase 6: Community Registry (Week 6)
- Component package format
- Add/publish commands
- Component creation wizard
- Search/browse functionality
- Security scanning pipeline

### Phase 7: Polish & Docs (Week 7)
- Error handling
- UX improvements
- Documentation
- Migration guide
- npm publish

---

## 🚨 Critical Issues Identified

### Security (BLOCKER)
- No component signing
- No malware scanning
- No secret detection
- **Action**: Add security layer in Phase 1

### Discovery (CRITICAL GAP)
- Users can't find components
- **Action**: Add browse/search in Phase 1

### Lockfile (CRITICAL GAP)
- No reproducible installs
- **Action**: Add lockfile in Phase 2

### Version Conflicts (CRITICAL GAP)
- No conflict resolution
- **Action**: Add semver + conflict detection in Phase 2

### Onboarding (HIGH PRIORITY)
- First-time users need guidance
- **Action**: Add interactive wizard in Phase 1

---

## 🎯 User Personas

### 1. Solo Developer (Primary)
- Uses OpenCode/Cursor for personal projects
- Wants quick setup, minimal config
- Explores new agents frequently
- Values speed and simplicity

### 2. Team Lead (Secondary)
- Manages 5-10 developers
- Needs standardized setup
- Wants to enforce best practices
- Values reproducibility

### 3. Content Creator (Emerging)
- Uses agents for writing, not coding
- Less technical, needs clear CLI
- Wants pre-built workflows
- Values templates and examples

### 4. Enterprise Admin (Future)
- Manages 50+ developers
- Needs security, compliance, governance
- Wants central management
- Values audit trails, policies

### 5. Open Source Maintainer (Future)
- Manages community contributions
- Needs quality control
- Wants automated workflows
- Values documentation

---

## 📚 Documentation Requirements

### Before Launch

1. **Quick Start** (5-minute guide)
2. **CLI Reference** (auto-generated)
3. **Recipes** (common workflows)
4. **Component Creation Guide**
5. **Migration Guide**
6. **Troubleshooting Guide**

### Post-Launch

7. **Video Tutorials**
8. **Interactive Playground**
9. **API Documentation**
10. **Plugin Development Guide**

---

## 📊 Success Metrics (6 Months)

| Metric | Target |
|--------|--------|
| GitHub stars | 1,000+ |
| npm downloads/month | 10,000+ |
| Community components | 50+ |
| Active contributors | 20+ |
| Docs page views | 5,000+/month |
| Support tickets | <5/week |

---

## 🔄 Next Steps

### Immediate
1. ✅ Consolidate planning documents
2. ⬜ Analyze user scenarios (5 parallel agents)
3. ⬜ Synthesize findings
4. ⬜ Finalize feature set
5. ⬜ Update implementation plan

### Before Phase 1
6. ⬜ Set up monorepo structure
7. ⬜ Create security scanning workflow
8. ⬜ Design TUI for browse command
9. ⬜ Write Quick Start docs

### Phase 1 Start
10. ⬜ TypeScript project setup
11. ⬜ Install dependencies
12. ⬜ Implement core systems
13. ⬜ Write tests

---

## 📝 Notes

- All planning documents are in `.tmp/PLANNING-REFACTOR/`
- User scenario analysis in progress (5 parallel agents)
- Synthesis and refinement will follow
- Implementation starts after planning complete

---

**Last Updated**: 2026-02-15  
**Status**: Planning Phase - Architecture Design Complete  
**Confidence**: High (98% - JSON config system designed)
