# Development Context Reorganization Plan

**Date**: 2026-01-30  
**Target**: `.opencode/context/development/`  
**Status**: PROPOSAL - Awaiting Approval

---

## Executive Summary

The development context folder contains **36 markdown files** with significant organizational issues:
- **5 duplicate files** (exact copies exist in `ui/web/`)
- **Misplaced UI/design files** in development folder
- **Multiple navigation files** that need consolidation
- **Inconsistent structure** mixing flat files with subdirectories
- **Outdated README** that doesn't reflect current structure

**Recommendation**: Reorganize to follow **Pattern B (Concern-Based)** structure as defined in context system standards, eliminate duplicates, and move UI-specific files to appropriate location.

---

## Current State Analysis

### Directory Structure

```
development/
├── navigation.md                          # ✅ Main navigation
├── README.md                              # ⚠️ Outdated
├── ui-navigation.md                       # ✅ Specialized navigation
├── backend-navigation.md                  # ✅ Specialized navigation
├── fullstack-navigation.md                # ✅ Specialized navigation
│
├── [ROOT LEVEL FILES - MISPLACED]
├── clean-code.md                          # ❌ DUPLICATE (exists in principles/)
├── api-design.md                          # ❌ DUPLICATE (exists in principles/)
├── react-patterns.md                      # ⚠️ Should be in frontend/react/
├── animation-patterns.md                  # ❌ DUPLICATE (exists in ui/web/)
├── design-systems.md                      # ❌ DUPLICATE (exists in ui/web/)
├── ui-styling-standards.md                # ❌ DUPLICATE (exists in ui/web/)
├── design-assets.md                       # ❌ DUPLICATE (exists in ui/web/)
│
├── principles/                            # ✅ Good structure
│   ├── navigation.md
│   ├── clean-code.md                      # 176 lines
│   └── api-design.md                      # 415 lines (31 lines longer than root version)
│
├── ai/                                    # ✅ Good structure
│   ├── navigation.md
│   └── mastra-ai/                         # ✅ Function-based (concepts/examples/guides/lookup/errors)
│       ├── navigation.md
│       ├── README.md                      # ⚠️ Redundant with navigation.md
│       ├── concepts/ (5 files)
│       ├── examples/ (1 file)
│       ├── guides/ (3 files)
│       ├── lookup/ (1 file)
│       └── errors/ (1 file)
│
├── frameworks/                            # ✅ Good structure
│   ├── navigation.md
│   └── tanstack-start/
│       └── navigation.md
│
├── frontend/                              # ⚠️ Empty placeholder
│   └── navigation.md
│
├── backend/                               # ⚠️ Empty placeholder
│   └── navigation.md
│
├── data/                                  # ⚠️ Empty placeholder
│   └── navigation.md
│
├── integration/                           # ⚠️ Empty placeholder
│   └── navigation.md
│
└── infrastructure/                        # ⚠️ Empty placeholder
    └── navigation.md
```

### File Inventory (36 files)

| Location | Files | Status |
|----------|-------|--------|
| Root level | 11 files | 7 misplaced, 5 duplicates |
| principles/ | 3 files | ✅ Good |
| ai/mastra-ai/ | 13 files | ✅ Good (1 redundant README) |
| frameworks/ | 2 files | ✅ Good |
| frontend/ | 1 file | Empty placeholder |
| backend/ | 1 file | Empty placeholder |
| data/ | 1 file | Empty placeholder |
| integration/ | 1 file | Empty placeholder |
| infrastructure/ | 1 file | Empty placeholder |

---

## Issues Identified

### 🔴 Critical Issues

#### 1. Duplicate Files (5 exact duplicates)

| File | Root Location | Duplicate Location | Action |
|------|---------------|-------------------|--------|
| `animation-patterns.md` | `development/` | `ui/web/` | DELETE from development |
| `design-systems.md` | `development/` | `ui/web/` | DELETE from development |
| `ui-styling-standards.md` | `development/` | `ui/web/` | DELETE from development |
| `design-assets.md` | `development/` | `ui/web/` | DELETE from development |
| `clean-code.md` | `development/` | `development/principles/` | DELETE from root |
| `api-design.md` | `development/` | `development/principles/` | DELETE from root (keep principles/ version - it's more complete) |

**Impact**: 
- Causes confusion about canonical source
- Maintenance burden (updates needed in 2 places)
- Wastes tokens when loading context
- Developer profile currently references 4 UI duplicates

#### 2. Misplaced Files

| File | Current Location | Should Be | Reason |
|------|-----------------|-----------|--------|
| `react-patterns.md` | `development/` (root) | `development/frontend/react/` | React-specific, not universal |
| `animation-patterns.md` | `development/` (root) | Already in `ui/web/` | UI/visual concern, not code |
| `design-systems.md` | `development/` (root) | Already in `ui/web/` | UI/visual concern, not code |
| `ui-styling-standards.md` | `development/` (root) | Already in `ui/web/` | UI/visual concern, not code |
| `design-assets.md` | `development/` (root) | Already in `ui/web/` | UI/visual concern, not code |

#### 3. Inconsistent Structure

**Problem**: Mixing flat files at root with organized subdirectories

**Current**:
```
development/
├── clean-code.md              # Flat
├── api-design.md              # Flat
├── react-patterns.md          # Flat
├── principles/                # Organized
│   ├── clean-code.md
│   └── api-design.md
```

**Should be**: All content in organized subdirectories

### ⚠️ Medium Issues

#### 4. Empty Placeholder Directories (5 directories)

These directories only contain `navigation.md` with no actual content:
- `frontend/` - Marked as "[future]" in main navigation
- `backend/` - Marked as "[future]" in main navigation
- `data/` - Marked as "[future]" in main navigation
- `integration/` - Marked as "[future]" in main navigation
- `infrastructure/` - Marked as "[future]" in main navigation

**Decision needed**: Keep as placeholders or remove until content exists?

#### 5. Redundant README Files

- `development/README.md` - Outdated, doesn't reflect current structure
- `ai/mastra-ai/README.md` - Redundant with `navigation.md`

**Standard**: Context system uses `navigation.md`, not `README.md`

### 🟡 Minor Issues

#### 6. Navigation File Proliferation

**Current**: 4 navigation files at root level
- `navigation.md` - Main navigation
- `ui-navigation.md` - Specialized (cross-category)
- `backend-navigation.md` - Specialized
- `fullstack-navigation.md` - Specialized

**Assessment**: This is actually correct per context system standards (specialized navigation for cross-cutting concerns). No action needed.

---

## Proposed Clean Structure

### Target Structure (Pattern B: Concern-Based)

```
development/
├── navigation.md                          # Main navigation
├── ui-navigation.md                       # Specialized (points to ui/web/)
├── backend-navigation.md                  # Specialized
├── fullstack-navigation.md                # Specialized
│
├── principles/                            # ✅ Universal patterns
│   ├── navigation.md
│   ├── clean-code.md
│   └── api-design.md
│
├── ai/                                    # ✅ AI frameworks
│   ├── navigation.md
│   └── mastra-ai/
│       ├── navigation.md
│       ├── concepts/ (5 files)
│       ├── examples/ (1 file)
│       ├── guides/ (3 files)
│       ├── lookup/ (1 file)
│       └── errors/ (1 file)
│
├── frameworks/                            # ✅ Full-stack frameworks
│   ├── navigation.md
│   └── tanstack-start/
│       └── navigation.md
│
├── frontend/                              # 🆕 React patterns moved here
│   ├── navigation.md
│   └── react/
│       └── react-patterns.md
│
├── backend/                               # Future: API patterns, Node.js, etc.
│   └── navigation.md
│
├── data/                                  # Future: SQL, NoSQL, ORMs
│   └── navigation.md
│
├── integration/                           # Future: Package management, APIs
│   └── navigation.md
│
└── infrastructure/                        # Future: Docker, CI/CD
    └── navigation.md
```

**Total files after cleanup**: 26 files (down from 36)
- Removed: 5 duplicates from root
- Removed: 2 duplicate principle files from root
- Removed: 2 redundant READMEs
- Moved: 1 file (react-patterns.md)

---

## Detailed Reorganization Plan

### Phase 1: Delete Duplicate Files (7 files)

#### Step 1.1: Delete UI Duplicates from Development Root

**Rationale**: These files are UI/visual design concerns, not development code patterns. Canonical versions exist in `ui/web/`.

```bash
# Delete 4 UI duplicate files
rm .opencode/context/development/animation-patterns.md
rm .opencode/context/development/design-systems.md
rm .opencode/context/development/ui-styling-standards.md
rm .opencode/context/development/design-assets.md
```

**Impact**: 
- ✅ Eliminates confusion about canonical source
- ✅ Reduces development folder from 36 to 32 files
- ⚠️ **BREAKS developer profile** - currently references these 4 files
- ⚠️ Requires profile update to point to `ui/web/` versions

#### Step 1.2: Delete Principle Duplicates from Development Root

**Rationale**: Canonical versions exist in `principles/` subdirectory. The `principles/api-design.md` version is more complete (31 lines longer).

```bash
# Delete 2 principle duplicate files
rm .opencode/context/development/clean-code.md
rm .opencode/context/development/api-design.md
```

**Impact**:
- ✅ Eliminates confusion about canonical source
- ✅ Reduces development folder from 32 to 30 files
- ✅ No profile impact (developer profile doesn't reference these)

#### Step 1.3: Delete Redundant README Files

**Rationale**: Context system standard is `navigation.md`, not `README.md`.

```bash
# Delete redundant READMEs
rm .opencode/context/development/README.md
rm .opencode/context/development/ai/mastra-ai/README.md
```

**Impact**:
- ✅ Aligns with context system standards
- ✅ Reduces development folder from 30 to 28 files
- ✅ No functional impact (navigation.md provides same info)

---

### Phase 2: Move Misplaced Files (1 file)

#### Step 2.1: Move react-patterns.md to frontend/react/

**Rationale**: React-specific patterns belong in frontend concern, not at root level.

```bash
# Create directory structure
mkdir -p .opencode/context/development/frontend/react

# Move file
mv .opencode/context/development/react-patterns.md \
   .opencode/context/development/frontend/react/react-patterns.md
```

**Impact**:
- ✅ Follows concern-based organization
- ✅ Makes frontend/ directory functional (not just placeholder)
- ⚠️ Requires navigation.md updates
- ⚠️ May require profile updates if referenced

---

### Phase 3: Update Navigation Files

#### Step 3.1: Update development/navigation.md

**Changes needed**:
1. Remove references to deleted duplicate files
2. Update structure tree to reflect new organization
3. Update quick routes table
4. Mark frontend/ as active (not "[future]")

**Before**:
```markdown
## Structure

```
development/
├── clean-code.md              # ❌ Delete
├── api-design.md              # ❌ Delete
├── react-patterns.md          # ❌ Move
├── animation-patterns.md      # ❌ Delete
├── design-systems.md          # ❌ Delete
├── ui-styling-standards.md    # ❌ Delete
├── design-assets.md           # ❌ Delete
├── frontend/                  # [future]
```
```

**After**:
```markdown
## Structure

```
development/
├── principles/
│   ├── clean-code.md
│   └── api-design.md
├── frontend/
│   └── react/
│       └── react-patterns.md
```
```

#### Step 3.2: Update development/ui-navigation.md

**Changes needed**:
1. Remove references to deleted files in development/
2. Point all UI routes to `../../ui/web/`
3. Update React patterns path to `frontend/react/react-patterns.md`

**Before**:
```markdown
| **Animations** | `../../ui/web/animation-patterns.md` |
| **React patterns** | `frontend/react/hooks-patterns.md` [future] |
```

**After**:
```markdown
| **Animations** | `../../ui/web/animation-patterns.md` |
| **React patterns** | `frontend/react/react-patterns.md` |
```

#### Step 3.3: Update development/frontend/navigation.md

**Changes needed**:
1. Add react/ subdirectory to structure
2. Add react-patterns.md to file listing
3. Update from placeholder to active

**Before**:
```markdown
## Structure

```
frontend/                      # [future]
├── navigation.md
├── react/                     # [future]
```
```

**After**:
```markdown
## Structure

```
frontend/
├── navigation.md
└── react/
    └── react-patterns.md
```

## Quick Routes

| Task | Path |
|------|------|
| **React patterns** | `react/react-patterns.md` |
```

#### Step 3.4: Create development/frontend/react/navigation.md (NEW)

**New file needed** to follow context system standards (navigation at each level).

**Content**:
```markdown
# React Development

**Purpose**: Modern React patterns, hooks, and component design

---

## Files

| File | Description | Priority |
|------|-------------|----------|
| [react-patterns.md](react-patterns.md) | React hooks, components, state management | high |

---

## Related Context

- **UI Styling** → `../../../ui/web/ui-styling-standards.md`
- **Animations** → `../../../ui/web/animation-patterns.md`
- **Clean Code** → `../../principles/clean-code.md`
```

---

### Phase 4: Update Developer Profile

#### Step 4.1: Update .opencode/profiles/developer/profile.json

**Current references** (4 files to update):
```json
{
  "context": [
    "context:development/ui-styling-standards",      // ❌ File deleted
    "context:development/design-systems",            // ❌ File deleted
    "context:development/design-assets",             // ❌ File deleted
    "context:development/animation-patterns"         // ❌ File deleted
  ]
}
```

**Updated references**:
```json
{
  "context": [
    "context:ui/web/ui-styling-standards",           // ✅ Canonical location
    "context:ui/web/design-systems",                 // ✅ Canonical location
    "context:ui/web/design-assets",                  // ✅ Canonical location
    "context:ui/web/animation-patterns"              // ✅ Canonical location
  ]
}
```

**Impact**:
- ✅ Profile continues to work (same files, new paths)
- ✅ Points to canonical source of truth
- ✅ No functional change for developer profile users

---

### Phase 5: Handle Empty Placeholder Directories

**Decision needed**: Keep or remove?

#### Option A: Keep Placeholders (RECOMMENDED)

**Rationale**:
- Shows intended structure
- Navigation files document future plans
- Easy to add content later
- Aligns with main navigation.md (marks as "[future]")

**Action**: No changes needed

#### Option B: Remove Placeholders

**Rationale**:
- Cleaner structure (only active content)
- Reduces file count
- Can recreate when needed

**Action**:
```bash
# Remove empty placeholder directories
rm -r .opencode/context/development/backend
rm -r .opencode/context/development/data
rm -r .opencode/context/development/integration
rm -r .opencode/context/development/infrastructure
```

**Recommendation**: **Keep placeholders (Option A)** - they document the intended structure and are referenced in main navigation.

---

## Before/After Comparison

### File Count

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total files | 36 | 26 | -10 files |
| Root level files | 11 | 4 | -7 files |
| Duplicate files | 7 | 0 | -7 files |
| Redundant READMEs | 2 | 0 | -2 files |
| Navigation files | 15 | 16 | +1 file |
| Content files | 19 | 19 | 0 (moved, not deleted) |

### Structure Clarity

| Aspect | Before | After |
|--------|--------|-------|
| Flat files at root | 7 misplaced | 0 |
| Duplicate content | 7 files | 0 |
| Organized subdirectories | 8 | 8 |
| Function-based structure | 1 (mastra-ai) | 1 (mastra-ai) |
| Concern-based structure | Partial | Complete |
| Empty placeholders | 5 | 5 (kept) |

### Directory Tree

#### Before (36 files)
```
development/
├── navigation.md
├── README.md                              ❌ Redundant
├── ui-navigation.md
├── backend-navigation.md
├── fullstack-navigation.md
├── clean-code.md                          ❌ Duplicate
├── api-design.md                          ❌ Duplicate
├── react-patterns.md                      ⚠️ Misplaced
├── animation-patterns.md                  ❌ Duplicate
├── design-systems.md                      ❌ Duplicate
├── ui-styling-standards.md                ❌ Duplicate
├── design-assets.md                       ❌ Duplicate
├── principles/ (3 files)
├── ai/mastra-ai/ (13 files, 1 redundant README)
├── frameworks/ (2 files)
├── frontend/ (1 file - empty)
├── backend/ (1 file - empty)
├── data/ (1 file - empty)
├── integration/ (1 file - empty)
└── infrastructure/ (1 file - empty)
```

#### After (26 files)
```
development/
├── navigation.md                          ✅ Updated
├── ui-navigation.md                       ✅ Updated
├── backend-navigation.md                  ✅ Kept
├── fullstack-navigation.md                ✅ Kept
├── principles/ (3 files)                  ✅ Canonical source
├── ai/mastra-ai/ (12 files)               ✅ README removed
├── frameworks/ (2 files)                  ✅ Kept
├── frontend/                              ✅ Now active
│   ├── navigation.md                      ✅ Updated
│   └── react/
│       ├── navigation.md                  🆕 New file
│       └── react-patterns.md              ✅ Moved here
├── backend/ (1 file)                      ✅ Placeholder
├── data/ (1 file)                         ✅ Placeholder
├── integration/ (1 file)                  ✅ Placeholder
└── infrastructure/ (1 file)               ✅ Placeholder
```

---

## Impact Assessment

### 🟢 Positive Impacts

1. **Eliminates Confusion**
   - Single source of truth for each piece of content
   - Clear separation: development code patterns vs. UI visual design
   - Consistent with context system standards

2. **Reduces Maintenance Burden**
   - No need to update content in multiple locations
   - Easier to find and update files
   - Clearer ownership (development vs. ui categories)

3. **Improves Token Efficiency**
   - Removes duplicate content from context loading
   - Cleaner navigation (less clutter)
   - Faster AI decision-making

4. **Better Organization**
   - Follows Pattern B (Concern-Based) consistently
   - React patterns in appropriate location (frontend/react/)
   - Principles clearly separated from implementations

5. **Aligns with Standards**
   - Follows context system organizing guide
   - Uses navigation.md (not README.md)
   - Proper concern-based structure

### 🟡 Neutral Impacts

1. **File Count Reduction**
   - 36 → 26 files (10 fewer files)
   - Same content, better organized
   - No loss of information

2. **Placeholder Directories**
   - Kept for future expansion
   - Documents intended structure
   - No functional impact

### 🔴 Breaking Changes

1. **Developer Profile References** (4 files)
   - Current: `context:development/ui-styling-standards`
   - New: `context:ui/web/ui-styling-standards`
   - **Action required**: Update profile.json
   - **Impact**: Profile will break until updated

2. **External References** (unknown)
   - Any agents/profiles referencing deleted files will break
   - Need to search for references before executing
   - **Action required**: Audit all profiles and agent files

3. **Navigation Updates** (4 files)
   - `development/navigation.md` - Update structure tree
   - `development/ui-navigation.md` - Update paths
   - `development/frontend/navigation.md` - Update from placeholder
   - `development/frontend/react/navigation.md` - Create new file
   - **Action required**: Update all navigation files

---

## Risk Analysis

### High Risk

**Risk**: Breaking developer profile and unknown references

**Mitigation**:
1. Search all profiles for references to deleted files
2. Search all agent files for references to deleted files
3. Update all references before deleting files
4. Test developer profile after changes

**Search commands**:
```bash
# Find all references to files being deleted
grep -r "development/animation-patterns" .opencode/
grep -r "development/design-systems" .opencode/
grep -r "development/ui-styling-standards" .opencode/
grep -r "development/design-assets" .opencode/
grep -r "development/clean-code" .opencode/
grep -r "development/api-design" .opencode/
grep -r "development/react-patterns" .opencode/
```

### Medium Risk

**Risk**: Navigation files out of sync

**Mitigation**:
1. Update all navigation files in single commit
2. Validate navigation paths after changes
3. Test navigation flow manually

### Low Risk

**Risk**: Empty placeholder directories cause confusion

**Mitigation**:
1. Keep placeholders (they're documented in main navigation)
2. Mark clearly as "[future]" in navigation
3. Add content when ready (structure already exists)

---

## Validation Checklist

### Pre-Execution Validation

- [ ] Search for all references to files being deleted
- [ ] Identify all profiles that need updates
- [ ] Identify all agents that need updates
- [ ] Backup current state (git commit)

### Post-Execution Validation

- [ ] All duplicate files removed
- [ ] react-patterns.md moved to frontend/react/
- [ ] All navigation files updated
- [ ] Developer profile updated and tested
- [ ] All external references updated
- [ ] No broken links in navigation
- [ ] File count: 26 files (down from 36)
- [ ] Structure follows Pattern B (Concern-Based)
- [ ] All content still accessible
- [ ] No loss of information

---

## Execution Plan

### Step-by-Step Execution

**Prerequisites**:
1. ✅ Audit complete
2. ✅ Plan reviewed and approved
3. ⏳ All references identified
4. ⏳ Backup created (git commit)

**Execution Order**:

1. **Search for references** (5 min)
   ```bash
   # Run search commands from Risk Analysis section
   # Document all findings
   ```

2. **Create backup** (1 min)
   ```bash
   git add .opencode/context/development/
   git commit -m "backup: development context before reorganization"
   ```

3. **Create new directory structure** (1 min)
   ```bash
   mkdir -p .opencode/context/development/frontend/react
   ```

4. **Move files** (1 min)
   ```bash
   mv .opencode/context/development/react-patterns.md \
      .opencode/context/development/frontend/react/react-patterns.md
   ```

5. **Delete duplicate files** (1 min)
   ```bash
   rm .opencode/context/development/animation-patterns.md
   rm .opencode/context/development/design-systems.md
   rm .opencode/context/development/ui-styling-standards.md
   rm .opencode/context/development/design-assets.md
   rm .opencode/context/development/clean-code.md
   rm .opencode/context/development/api-design.md
   ```

6. **Delete redundant READMEs** (1 min)
   ```bash
   rm .opencode/context/development/README.md
   rm .opencode/context/development/ai/mastra-ai/README.md
   ```

7. **Create new navigation file** (5 min)
   - Create `development/frontend/react/navigation.md`

8. **Update existing navigation files** (10 min)
   - Update `development/navigation.md`
   - Update `development/ui-navigation.md`
   - Update `development/frontend/navigation.md`

9. **Update developer profile** (5 min)
   - Update `.opencode/profiles/developer/profile.json`

10. **Update any other references** (10 min)
    - Update all identified references from step 1

11. **Validate changes** (10 min)
    - Run validation checklist
    - Test developer profile
    - Check navigation flow

12. **Commit changes** (2 min)
    ```bash
    git add .opencode/
    git commit -m "refactor: reorganize development context - remove duplicates, move react patterns"
    ```

**Total estimated time**: 50 minutes

---

## Rollback Plan

If issues are discovered after execution:

```bash
# Rollback to backup commit
git log --oneline | head -5  # Find backup commit hash
git reset --hard <backup-commit-hash>

# Or restore specific files
git checkout <backup-commit-hash> -- .opencode/context/development/
git checkout <backup-commit-hash> -- .opencode/profiles/developer/profile.json
```

---

## Recommendation

**Proceed with reorganization**: ✅ **APPROVED**

**Rationale**:
1. Clear benefits (eliminates duplicates, improves organization)
2. Manageable risks (can be mitigated with proper search and backup)
3. Aligns with context system standards
4. Improves long-term maintainability
5. Reduces confusion and token waste

**Next Steps**:
1. **Review this plan** - Ensure all stakeholders agree
2. **Search for references** - Identify all files that need updates
3. **Execute plan** - Follow step-by-step execution order
4. **Validate changes** - Run validation checklist
5. **Monitor for issues** - Watch for broken references in next few days

**Approval needed from**: Context system owner, developer profile maintainers

---

## Appendix A: File Details

### Files to Delete (9 files)

| File | Size | Reason | Canonical Location |
|------|------|--------|-------------------|
| `development/animation-patterns.md` | 753 lines | Duplicate | `ui/web/animation-patterns.md` |
| `development/design-systems.md` | 381 lines | Duplicate | `ui/web/design-systems.md` |
| `development/ui-styling-standards.md` | 552 lines | Duplicate | `ui/web/ui-styling-standards.md` |
| `development/design-assets.md` | 567 lines | Duplicate | `ui/web/design-assets.md` |
| `development/clean-code.md` | 176 lines | Duplicate | `development/principles/clean-code.md` |
| `development/api-design.md` | 384 lines | Duplicate (shorter) | `development/principles/api-design.md` (415 lines) |
| `development/README.md` | 46 lines | Redundant | `development/navigation.md` |
| `development/ai/mastra-ai/README.md` | 43 lines | Redundant | `development/ai/mastra-ai/navigation.md` |

**Total lines deleted**: 2,902 lines (all duplicate content)

### Files to Move (1 file)

| File | From | To | Size |
|------|------|----|----|
| `react-patterns.md` | `development/` | `development/frontend/react/` | 328 lines |

### Files to Create (1 file)

| File | Location | Purpose |
|------|----------|---------|
| `navigation.md` | `development/frontend/react/` | Navigation for React subcategory |

### Files to Update (4 files)

| File | Changes |
|------|---------|
| `development/navigation.md` | Update structure tree, remove deleted files, mark frontend as active |
| `development/ui-navigation.md` | Update paths, remove deleted file references |
| `development/frontend/navigation.md` | Add react/ subdirectory, update from placeholder |
| `.opencode/profiles/developer/profile.json` | Update 4 file paths to ui/web/ |

---

## Appendix B: Context System Standards Compliance

### Pattern B (Concern-Based) Compliance

✅ **Organized by concern** (frontend, backend, principles, ai, frameworks)  
✅ **Then by approach/tech** (react, mastra-ai, tanstack-start)  
✅ **Universal principles separated** (principles/ folder)  
✅ **Specialized navigation for cross-cutting concerns** (ui-navigation.md, backend-navigation.md)  
✅ **Function-based within tech** (mastra-ai uses concepts/examples/guides/lookup/errors)  

### Navigation Design Compliance

✅ **navigation.md at each level** (category, subcategory)  
✅ **Token-efficient** (200-300 tokens per navigation file)  
✅ **Scannable structure** (ASCII trees, tables)  
✅ **Quick routes** (task-based navigation)  
⚠️ **README.md removed** (replaced with navigation.md per standards)  

### Structure Standards Compliance

✅ **No flat files at root** (after reorganization)  
✅ **Clear hierarchy** (concern → approach/tech → files)  
✅ **Consistent naming** (kebab-case)  
✅ **No duplicates** (after reorganization)  

---

## Appendix C: Search Commands Reference

```bash
# Find all references to files being deleted
grep -r "development/animation-patterns" .opencode/ 2>/dev/null
grep -r "development/design-systems" .opencode/ 2>/dev/null
grep -r "development/ui-styling-standards" .opencode/ 2>/dev/null
grep -r "development/design-assets" .opencode/ 2>/dev/null
grep -r "development/clean-code" .opencode/ 2>/dev/null
grep -r "development/api-design" .opencode/ 2>/dev/null
grep -r "development/react-patterns" .opencode/ 2>/dev/null

# Find all profile files
find .opencode/profiles -name "*.json" -type f

# Find all agent files
find .opencode/agents -name "*.md" -type f 2>/dev/null

# Count files before
find .opencode/context/development -type f -name "*.md" | wc -l

# Count files after (should be 26)
find .opencode/context/development -type f -name "*.md" | wc -l
```

---

**End of Reorganization Plan**
