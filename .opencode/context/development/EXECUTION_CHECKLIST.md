# Development Context Reorganization - Execution Checklist

**Date**: 2026-01-30  
**Estimated Time**: 50 minutes  
**Status**: ⏳ AWAITING APPROVAL

---

## Pre-Execution Checklist

- [ ] Review `REORGANIZATION_SUMMARY.md`
- [ ] Review `REORGANIZATION_PLAN.md`
- [ ] Review `VISUAL_COMPARISON.md`
- [ ] Approval obtained
- [ ] Backup plan understood
- [ ] All team members notified

---

## Execution Steps

### Step 1: Create Backup (1 min)

```bash
cd /Users/darrenhinde/Documents/GitHub/MYBUSINESS/OpenAgentsControl

# Create backup commit
git add .opencode/context/development/
git commit -m "backup: development context before reorganization"

# Note the commit hash for rollback
git log -1 --oneline
```

**Validation**: ✅ Commit created successfully

---

### Step 2: Create New Directory Structure (1 min)

```bash
# Create frontend/react directory
mkdir -p .opencode/context/development/frontend/react
```

**Validation**: ✅ Directory exists

---

### Step 3: Move react-patterns.md (1 min)

```bash
# Move file
mv .opencode/context/development/react-patterns.md \
   .opencode/context/development/frontend/react/react-patterns.md
```

**Validation**: 
- [ ] File moved successfully
- [ ] Old location empty
- [ ] New location contains file

---

### Step 4: Delete Duplicate UI Files (1 min)

```bash
# Delete 4 UI duplicate files
rm .opencode/context/development/animation-patterns.md
rm .opencode/context/development/design-systems.md
rm .opencode/context/development/ui-styling-standards.md
rm .opencode/context/development/design-assets.md
```

**Validation**: 
- [ ] 4 files deleted
- [ ] Canonical versions still exist in ui/web/

---

### Step 5: Delete Duplicate Principle Files (1 min)

```bash
# Delete 2 principle duplicate files
rm .opencode/context/development/clean-code.md
rm .opencode/context/development/api-design.md
```

**Validation**: 
- [ ] 2 files deleted
- [ ] Canonical versions still exist in principles/

---

### Step 6: Delete Redundant READMEs (1 min)

```bash
# Delete redundant READMEs
rm .opencode/context/development/README.md
rm .opencode/context/development/ai/mastra-ai/README.md
```

**Validation**: 
- [ ] 2 files deleted
- [ ] navigation.md files still exist

---

### Step 7: Create New Navigation File (5 min)

Create: `.opencode/context/development/frontend/react/navigation.md`

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

**Validation**: 
- [ ] File created
- [ ] Content correct
- [ ] Links work

---

### Step 8: Update development/navigation.md (3 min)

**File**: `.opencode/context/development/navigation.md`

**Changes**:
1. Remove deleted files from structure tree
2. Update frontend/ from "[future]" to active
3. Add react/ subdirectory

**Key sections to update**:
- Structure tree (lines 9-58)
- Remove references to deleted files

**Validation**: 
- [ ] Structure tree updated
- [ ] No references to deleted files
- [ ] frontend/ marked as active

---

### Step 9: Update development/ui-navigation.md (2 min)

**File**: `.opencode/context/development/ui-navigation.md`

**Changes**:
1. Update React patterns path from "[future]" to actual path

**Find and replace**:
```diff
- | **React patterns** | `frontend/react/hooks-patterns.md` [future] |
+ | **React patterns** | `frontend/react/react-patterns.md` |
```

**Validation**: 
- [ ] React patterns path updated
- [ ] All UI routes point to ui/web/

---

### Step 10: Update development/frontend/navigation.md (3 min)

**File**: `.opencode/context/development/frontend/navigation.md`

**Changes**:
1. Add react/ subdirectory to structure
2. Add Quick Routes section
3. Update from placeholder to active

**Validation**: 
- [ ] Structure updated
- [ ] Quick Routes added
- [ ] No longer marked as "[future]"

---

### Step 11: Update Developer Profile (5 min)

**File**: `.opencode/profiles/developer/profile.json`

**Find and replace** (4 updates):

```diff
- "context:development/ui-styling-standards",
+ "context:ui/web/ui-styling-standards",

- "context:development/design-systems",
+ "context:ui/web/design-systems",

- "context:development/design-assets",
+ "context:ui/web/design-assets",

- "context:development/animation-patterns",
+ "context:ui/web/animation-patterns",
```

**Validation**: 
- [ ] All 4 paths updated
- [ ] JSON still valid
- [ ] Profile loads successfully

---

### Step 12: Update core/visual-development.md (5 min)

**File**: `.opencode/context/core/visual-development.md`

**Find and replace** (6 updates):

```diff
- | **Animation patterns** | `development/animation-patterns.md` | - | - |
+ | **Animation patterns** | `ui/web/animation-patterns.md` | - | - |

- | **Design system** | `development/design-systems.md` | - | - |
+ | **Design system** | `ui/web/design-systems.md` | - | - |

- | **UI standards** | `development/ui-styling-standards.md` | - | - |
+ | **UI standards** | `ui/web/ui-styling-standards.md` | - | - |

- - **Animation Patterns**: `.opencode/context/development/animation-patterns.md`
+ - **Animation Patterns**: `.opencode/context/ui/web/animation-patterns.md`

- - **Design Systems**: `.opencode/context/development/design-systems.md`
+ - **Design Systems**: `.opencode/context/ui/web/design-systems.md`

- - **UI Styling Standards**: `.opencode/context/development/ui-styling-standards.md`
+ - **UI Styling Standards**: `.opencode/context/ui/web/ui-styling-standards.md`
```

**Validation**: 
- [ ] All 6 paths updated
- [ ] File still valid

---

### Step 13: Update core/workflows/design-iteration.md (5 min)

**File**: `.opencode/context/core/workflows/design-iteration.md`

**Find and replace** (4 updates):

```diff
- - [Animation Patterns](../development/animation-patterns.md)
+ - [Animation Patterns](../ui/web/animation-patterns.md)

- - [Design Systems Context](../development/design-systems.md)
+ - [Design Systems Context](../ui/web/design-systems.md)

- - [UI Styling Standards](../development/ui-styling-standards.md)
+ - [UI Styling Standards](../ui/web/ui-styling-standards.md)

- - [Design Assets](../development/design-assets.md)
+ - [Design Assets](../ui/web/design-assets.md)
```

**Validation**: 
- [ ] All 4 paths updated
- [ ] Links work

---

### Step 14: Update openagents-repo/lookup/file-locations.md (2 min)

**File**: `.opencode/context/openagents-repo/lookup/file-locations.md`

**Find and replace** (1 update):

```diff
- - `.opencode/context/development/react-patterns.md`
+ - `.opencode/context/development/frontend/react/react-patterns.md`
```

**Validation**: 
- [ ] Path updated
- [ ] File still valid

---

### Step 15: Validate File Count (2 min)

```bash
# Count files
find .opencode/context/development -type f -name "*.md" | wc -l
```

**Expected**: 26 files

**Validation**: 
- [ ] File count is 26 (down from 36)

---

### Step 16: Validate No Duplicates (2 min)

```bash
# Check that deleted files are gone
ls .opencode/context/development/animation-patterns.md 2>/dev/null
ls .opencode/context/development/design-systems.md 2>/dev/null
ls .opencode/context/development/ui-styling-standards.md 2>/dev/null
ls .opencode/context/development/design-assets.md 2>/dev/null
ls .opencode/context/development/clean-code.md 2>/dev/null
ls .opencode/context/development/api-design.md 2>/dev/null
ls .opencode/context/development/README.md 2>/dev/null
ls .opencode/context/development/ai/mastra-ai/README.md 2>/dev/null
```

**Expected**: All commands should return "No such file or directory"

**Validation**: 
- [ ] All 8 files deleted
- [ ] No duplicates exist

---

### Step 17: Validate Moved File (1 min)

```bash
# Check that react-patterns.md moved
ls .opencode/context/development/react-patterns.md 2>/dev/null
ls .opencode/context/development/frontend/react/react-patterns.md
```

**Expected**: 
- First command: "No such file or directory"
- Second command: File exists

**Validation**: 
- [ ] Old location empty
- [ ] New location has file

---

### Step 18: Test Developer Profile (3 min)

```bash
# Validate JSON syntax
cat .opencode/profiles/developer/profile.json | jq . > /dev/null
```

**Expected**: No errors

**Validation**: 
- [ ] JSON valid
- [ ] All 4 paths updated
- [ ] Profile loads successfully

---

### Step 19: Test Navigation Links (3 min)

Manually check:
1. `.opencode/context/development/navigation.md` - All links work
2. `.opencode/context/development/ui-navigation.md` - All links work
3. `.opencode/context/development/frontend/navigation.md` - All links work
4. `.opencode/context/development/frontend/react/navigation.md` - All links work

**Validation**: 
- [ ] All navigation links work
- [ ] No broken references

---

### Step 20: Commit Changes (2 min)

```bash
# Stage all changes
git add .opencode/

# Commit with descriptive message
git commit -m "refactor(context): reorganize development folder

- Remove 7 duplicate files (ui/design files exist in ui/web/)
- Remove 2 redundant READMEs (use navigation.md instead)
- Move react-patterns.md to frontend/react/
- Update 4 navigation files
- Update developer profile (4 path changes)
- Update 3 core context files (11 path changes)

Result: 26 files (down from 36), no duplicates, clean structure

Refs: REORGANIZATION_PLAN.md, REORGANIZATION_SUMMARY.md"
```

**Validation**: 
- [ ] Commit successful
- [ ] All changes included

---

## Post-Execution Validation

### Final Checklist

- [ ] File count: 26 (down from 36)
- [ ] Root level: 4 files (all navigation)
- [ ] No duplicate files exist
- [ ] react-patterns.md in frontend/react/
- [ ] Developer profile works (4 paths updated)
- [ ] Core context files work (11 paths updated)
- [ ] All navigation links work
- [ ] No broken references
- [ ] frontend/ directory is active (not placeholder)
- [ ] All README.md files removed
- [ ] Git commit created
- [ ] No errors in validation

---

## Rollback Instructions

If issues are discovered:

```bash
# Find backup commit
git log --oneline | head -5

# Rollback to backup (replace <hash> with actual commit hash)
git reset --hard <backup-commit-hash>

# Or restore specific files
git checkout <backup-commit-hash> -- .opencode/context/development/
git checkout <backup-commit-hash> -- .opencode/profiles/developer/profile.json
git checkout <backup-commit-hash> -- .opencode/context/core/
git checkout <backup-commit-hash> -- .opencode/context/openagents-repo/lookup/
```

---

## Success Criteria

✅ All steps completed without errors  
✅ All validations passed  
✅ File count correct (26 files)  
✅ No duplicate files  
✅ All references updated  
✅ Developer profile works  
✅ Navigation links work  
✅ Git commit created  

---

## Time Tracking

| Step | Estimated | Actual | Notes |
|------|-----------|--------|-------|
| 1. Backup | 1 min | | |
| 2. Create dirs | 1 min | | |
| 3. Move file | 1 min | | |
| 4. Delete UI dupes | 1 min | | |
| 5. Delete principle dupes | 1 min | | |
| 6. Delete READMEs | 1 min | | |
| 7. Create nav file | 5 min | | |
| 8. Update dev nav | 3 min | | |
| 9. Update ui nav | 2 min | | |
| 10. Update frontend nav | 3 min | | |
| 11. Update profile | 5 min | | |
| 12. Update visual-dev | 5 min | | |
| 13. Update design-iteration | 5 min | | |
| 14. Update file-locations | 2 min | | |
| 15. Validate count | 2 min | | |
| 16. Validate dupes | 2 min | | |
| 17. Validate move | 1 min | | |
| 18. Test profile | 3 min | | |
| 19. Test nav | 3 min | | |
| 20. Commit | 2 min | | |
| **TOTAL** | **50 min** | | |

---

## Notes

Use this space to record any issues, deviations, or observations during execution:

```
[Add notes here]
```

---

**Status**: ⏳ Ready for execution after approval

**Next Step**: Obtain approval, then execute steps 1-20 in order
