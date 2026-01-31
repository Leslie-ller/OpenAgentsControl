---
description: Interactive wizard to add project patterns using Project Intelligence standard
tags: [context, onboarding, project-intelligence, wizard]
dependencies:
  - subagent:context-organizer
  - context:core/context-system/standards/mvi.md
  - context:core/context-system/standards/frontmatter.md
  - context:core/standards/project-intelligence.md
---

<context>
  <system>Project Intelligence onboarding wizard for teaching agents YOUR coding patterns</system>
  <domain>Project-specific context creation w/ MVI compliance</domain>
  <task>Interactive 6-question wizard → structured context files w/ 100% pattern preservation</task>
</context>

<role>Context Creation Wizard applying Project Intelligence + MVI + frontmatter standards</role>

<task>6-question wizard → technical-domain.md w/ tech stack, API/component patterns, naming, standards, security</task>

<critical_rules priority="absolute" enforcement="strict">
  <rule id="project_intelligence">
    MUST create technical-domain.md in project-intelligence/ dir (NOT single project-context.md)
  </rule>
  <rule id="frontmatter_required">
    ALL files MUST start w/ HTML frontmatter: <!-- Context: {category}/{function} | Priority: {level} | Version: X.Y | Updated: YYYY-MM-DD -->
  </rule>
  <rule id="mvi_compliance">
    Files MUST be <200 lines, scannable <30s. MVI formula: 1-3 sentence concept, 3-5 key points, 5-10 line example, ref link
  </rule>
  <rule id="codebase_refs">
    ALL files MUST include "📂 Codebase References" section linking context→actual code implementation
  </rule>
  <rule id="navigation_update">
    MUST update navigation.md when creating/modifying files (add to Quick Routes or Deep Dives table)
  </rule>
  <rule id="priority_assignment">
    MUST assign priority based on usage: critical (80%) | high (15%) | medium (4%) | low (1%)
  </rule>
  <rule id="version_tracking">
    MUST track versions: New file→1.0 | Content update→MINOR (1.1, 1.2) | Structure change→MAJOR (2.0, 3.0)
  </rule>
</critical_rules>

<execution_priority>
  <tier level="1" desc="Project Intelligence + MVI + Standards">
    - @project_intelligence (technical-domain.md in project-intelligence/ dir)
    - @mvi_compliance (<200 lines, <30s scannable)
    - @frontmatter_required (HTML frontmatter w/ metadata)
    - @codebase_refs (link context→code)
    - @navigation_update (update navigation.md)
    - @priority_assignment (critical for tech stack/core patterns)
    - @version_tracking (1.0 for new, incremented for updates)
  </tier>
  <tier level="2" desc="Wizard Workflow">
    - Detect existing context→Review/Add/Replace
    - 6-question interactive wizard
    - Generate/update technical-domain.md
    - Validation w/ MVI checklist
  </tier>
  <tier level="3" desc="User Experience">
    - Clear formatting w/ ━ dividers
    - Helpful examples
    - Next steps guidance
  </tier>
  <conflict_resolution>Tier 1 always overrides Tier 2/3 - standards are non-negotiable</conflict_resolution>
</execution_priority>

---

## Purpose

Help users add project patterns using Project Intelligence standard. **Easiest way** to teach agents YOUR coding patterns.

**Value**: Answer 6 questions (~5 min) → properly structured context files → agents generate code matching YOUR project.

**Standards**: @project_intelligence + @mvi_compliance + @frontmatter_required + @codebase_refs

**Note**: External context files are stored in `.tmp/` directory (e.g., `.tmp/external-context.md`) for temporary or external knowledge that will be organized into the permanent context system.

**External Context Integration**: The wizard automatically detects external context files in `.tmp/` and offers to extract and use them as source material for your project patterns.

---

## Usage

```bash
/add-context                 # Interactive wizard (recommended)
/add-context --update        # Update existing context
/add-context --tech-stack    # Add/update tech stack only
/add-context --patterns      # Add/update code patterns only
```

---

## Quick Start

**Run**: `/add-context`

**What happens**:
1. Checks for external context files in `.tmp/` (if found, offers to extract)
2. Checks for existing project intelligence
3. Asks 6 questions (~5 min) OR reviews existing patterns
4. Generates/updates technical-domain.md
5. Agents now use YOUR patterns

**6 Questions** (~5 min):
1. Tech stack?
2. API endpoint example?
3. Component example?
4. Naming conventions?
5. Code standards?
6. Security requirements?

**Done!** Agents now use YOUR patterns.

**Management Options**:
- Update patterns: `/add-context --update`
- Manage external files: `/add-context` → Choose "Manage external files"
- Harvest to permanent: `/context harvest`
- Clean context: `/add-context` → Choose "Clean all"

---

## Workflow

### Stage 0: Detect External Context Files

Check: `.tmp/` directory for external context files (e.g., `.tmp/external-context.md`, `.tmp/context-*.md`)

**If external files found**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found external context files in .tmp/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files found:
  📄 .tmp/external-context.md (2.4 KB)
  📄 .tmp/api-patterns.md (1.8 KB)
  📄 .tmp/component-guide.md (3.1 KB)

These files can be extracted and used to build your project intelligence.

Options:
  1. Extract & use these files (recommended)
  2. Skip external files
  3. Manage external files (update/remove/clean)
  4. Harvest to permanent context (via /context harvest)

Choose [1/2/3/4]: _
```

**If option 1 (Extract & use)**:
- Read external files
- Extract patterns (tech stack, APIs, components, naming, standards, security)
- Merge with existing project intelligence
- Proceed to Stage 1

**If option 3 (Manage external files)**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manage External Context Files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files in .tmp/:
  A) .tmp/external-context.md (2.4 KB)
  B) .tmp/api-patterns.md (1.8 KB)
  C) .tmp/component-guide.md (3.1 KB)

Actions:
  1. Update file (edit content)
  2. Remove file (delete from .tmp/)
  3. Clean all (delete all .tmp/ context files)
  4. Harvest (move to permanent context via /context harvest)
  5. Back to main menu

Choose file [A/B/C] then action [1/2/3/4/5]: _
```

**If option 4 (Harvest)**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Harvest External Context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To harvest external context files to permanent context:

  /context harvest

This will:
  ✓ Extract knowledge from .tmp/ files
  ✓ Organize into project-intelligence/
  ✓ Clean up temporary files
  ✓ Update navigation.md

Ready? [y/n]: _
```

---

### Stage 1: Detect Existing Context

Check: `~/.opencode/context/project-intelligence/`

**If exists**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found existing project intelligence!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files found:
  ✓ technical-domain.md (Version: 1.2, Updated: 2026-01-15)
  ✓ business-domain.md (Version: 1.0, Updated: 2026-01-10)
  ✓ navigation.md

Current patterns:
  📦 Tech Stack: Next.js 14 + TypeScript + PostgreSQL + Tailwind
  🔧 API: Zod validation, error handling
  🎨 Component: Functional components, TypeScript props
  📝 Naming: kebab-case files, PascalCase components
  ✅ Standards: TypeScript strict, Drizzle ORM
  🔒 Security: Input validation, parameterized queries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Options:
  1. Review and update patterns (show each one)
  2. Add new patterns (keep all existing)
  3. Replace all patterns (start fresh, backup old)
  4. Cancel

Choose [1/2/3/4]: _
```

**If not exists**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No project intelligence found. Let's create it!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Will create:
  - project-intelligence/technical-domain.md (tech stack & patterns)
  - project-intelligence/navigation.md (quick overview)

Takes ~5 min. Follows @mvi_compliance (<200 lines).

Ready? [y/n]: _
```

---

### Stage 1.5: Review Existing Patterns (if updating)

**Only runs if user chose "Review and update" in Stage 1.**

For each pattern, show current→ask Keep/Update/Remove:

#### Pattern 1: Tech Stack
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pattern 1/6: Tech Stack
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current:
  Framework: Next.js 14
  Language: TypeScript
  Database: PostgreSQL
  Styling: Tailwind

Options: 1. Keep | 2. Update | 3. Remove
Choose [1/2/3]: _

If '2': New tech stack: _
```

#### Pattern 2: API Pattern
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pattern 2/6: API Pattern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current API pattern:
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = schema.parse(body)
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }
}
```

Options: 1. Keep | 2. Update | 3. Remove
Choose [1/2/3]: _

If '2': Paste new API pattern: _
```

#### Pattern 3-6: Component, Naming, Standards, Security
*(Same format: show current→Keep/Update/Remove)*

**After reviewing all**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Review Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes:
  ✓ Tech Stack: Updated (Next.js 14 → Next.js 15)
  ✓ API: Kept
  ✓ Component: Updated (new pattern)
  ✓ Naming: Kept
  ✓ Standards: Updated (+2 new)
  ✓ Security: Kept

Version: 1.2 → 1.3 (content update per @version_tracking)
Updated: 2026-01-29

Proceed? [y/n]: _
```

---

### Stage 2: Interactive Wizard (for new patterns)

#### Q1: Tech Stack
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q 1/6: What's your tech stack?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Examples:
  1. Next.js + TypeScript + PostgreSQL + Tailwind
  2. React + Python + MongoDB + Material-UI
  3. Vue + Go + MySQL + Bootstrap
  4. Other (describe)

Your tech stack: _
```

**Capture**: Framework, Language, Database, Styling

#### Q2: API Pattern
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q 2/6: API endpoint example?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Paste API endpoint from YOUR project (matches your API style).

Example (Next.js):
```typescript
export async function POST(request: Request) {
  const body = await request.json()
  const validated = schema.parse(body)
  return Response.json({ success: true })
}
```

Your API pattern (paste or 'skip'): _
```

**Capture**: API endpoint, error handling, validation, response format

#### Q3: Component Pattern
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q 3/6: Component example?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Paste component from YOUR project.

Example (React):
```typescript
interface UserCardProps { name: string; email: string }
export function UserCard({ name, email }: UserCardProps) {
  return <div className="rounded-lg border p-4">
    <h3>{name}</h3><p>{email}</p>
  </div>
}
```

Your component (paste or 'skip'): _
```

**Capture**: Component structure, props pattern, styling, TypeScript

#### Q4: Naming Conventions
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q 4/6: Naming conventions?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Examples:
  Files: kebab-case (user-profile.tsx)
  Components: PascalCase (UserProfile)
  Functions: camelCase (getUserProfile)
  Database: snake_case (user_profiles)

Your conventions:
  Files: _
  Components: _
  Functions: _
  Database: _
```

#### Q5: Code Standards
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q 5/6: Code standards?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Examples:
  - TypeScript strict mode
  - Validate w/ Zod
  - Use Drizzle for DB queries
  - Prefer server components

Your standards (one/line, 'done' when finished):
  1. _
```

#### Q6: Security Requirements
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q 6/6: Security requirements?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Examples:
  - Validate all user input
  - Use parameterized queries
  - Sanitize before rendering
  - HTTPS only

Your requirements (one/line, 'done' when finished):
  1. _
```

---

### Stage 3: Generate/Update Context

**Preview**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preview: technical-domain.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-01-29 -->

# Technical Domain

**Purpose**: Tech stack, architecture, development patterns for this project.
**Last Updated**: 2026-01-29

## Quick Reference
**Update Triggers**: Tech stack changes | New patterns | Architecture decisions
**Audience**: Developers, AI agents

## Primary Stack
| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | {framework} | {version} | {why} |
| Language | {language} | {version} | {why} |
| Database | {database} | {version} | {why} |
| Styling | {styling} | {version} | {why} |

## Code Patterns
### API Endpoint
```{language}
{user_api_pattern}
```

### Component
```{language}
{user_component_pattern}
```

## Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Files | {file_naming} | {example} |
| Components | {component_naming} | {example} |
| Functions | {function_naming} | {example} |
| Database | {db_naming} | {example} |

## Code Standards
{user_code_standards}

## Security Requirements
{user_security_requirements}

## 📂 Codebase References
**Implementation**: `{detected_files}` - {desc}
**Config**: package.json, tsconfig.json

## Related Files
- [Business Domain](business-domain.md)
- [Decisions Log](decisions-log.md)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Size: {line_count} lines (limit: 200 per @mvi_compliance)
Status: ✅ MVI compliant

Save to: ~/.opencode/context/project-intelligence/technical-domain.md

Looks good? [y/n/edit]: _
```

**Actions**:
- Confirm: Write file per @project_intelligence
- Edit: Open in editor→validate after
- Update: Show diff→highlight new→confirm

---

### Stage 4: Validation & Creation

**Validation**:
```
Running validation...

✅ <200 lines (@mvi_compliance)
✅ Has HTML frontmatter (@frontmatter_required)
✅ Has metadata (Purpose, Last Updated)
✅ Has codebase refs (@codebase_refs)
✅ Priority assigned: critical (@priority_assignment)
✅ Version set: 1.0 (@version_tracking)
✅ MVI compliant (<30s scannable)
✅ No duplication

Creating files per @project_intelligence...
  ✓ technical-domain.md
  ✓ navigation.md (updated per @navigation_update)

Done!
```

---

### Stage 5: Confirmation & Next Steps

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Project Intelligence created successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files created:
  ~/.opencode/context/project-intelligence/technical-domain.md
  ~/.opencode/context/project-intelligence/navigation.md

Agents now use YOUR patterns automatically!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What's next?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Test it:
   opencode --agent OpenCoder
   > "Create API endpoint"
   (Uses YOUR pattern!)

2. Review: cat ~/.opencode/context/project-intelligence/technical-domain.md

3. Add business context: /add-context --business

4. Build: opencode --agent OpenCoder > "Create user auth system"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Tip: Update context as project evolves
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When you:
  Add library → /add-context --update
  Change patterns → /add-context --update
  Migrate tech → /add-context --update

Agents stay synced!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Learn More
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Project Intelligence: .opencode/context/core/standards/project-intelligence.md
- MVI Principles: .opencode/context/core/context-system/standards/mvi.md
- Context System: CONTEXT_SYSTEM_GUIDE.md
```

---

## Implementation Details

### External Context Detection (Stage 0)

**Process**:
1. Check: `ls .tmp/external-context.md .tmp/context-*.md .tmp/*-context.md 2>/dev/null`
2. If files found:
   - Read each file
   - Extract patterns (tech stack, APIs, components, naming, standards, security)
   - Offer options: Extract & use | Skip | Manage | Harvest
3. If option 1 (Extract & use):
   - Parse external files for patterns
   - Merge with existing project intelligence (if exists)
   - Proceed to Stage 1 with pre-filled patterns
4. If option 3 (Manage):
   - Show file list with sizes
   - Offer: Update | Remove | Clean all | Harvest | Back
   - Execute selected action
   - Return to main menu or exit
5. If option 4 (Harvest):
   - Guide user to `/context harvest` command
   - Explain what harvest does
   - Exit add-context

### Pattern Detection (Stage 1)

**Process**:
1. Check: `ls ~/.opencode/context/project-intelligence/`
2. Read: `cat technical-domain.md` (if exists)
3. Parse existing patterns:
   - Frontmatter: version, updated date
   - Tech stack: "Primary Stack" table
   - API/Component: "Code Patterns" section
   - Naming: "Naming Conventions" table
   - Standards: "Code Standards" section
   - Security: "Security Requirements" section
4. Display summary
5. Offer options: Review/Add/Replace/Cancel

### Pattern Review (Stage 1.5)

**Per pattern**:
1. Show current value (parsed from file)
2. Ask: Keep | Update | Remove
3. If Update: Prompt for new value
4. Track changes in `changes_to_make[]`

**After all reviewed**:
1. Show summary
2. Calculate version per @version_tracking (content→MINOR, structure→MAJOR)
3. Confirm
4. Proceed to Stage 3

### Delegation to ContextOrganizer

```yaml
operation: create | update | extract_external | manage_external
template: technical-domain  # Project Intelligence template
target_directory: project-intelligence

# For normal create/update
user_responses:
  tech_stack: {framework, language, database, styling}
  api_pattern: string | null
  component_pattern: string | null
  naming_conventions: {files, components, functions, database}
  code_standards: string[]
  security_requirements: string[]

# For external context extraction
external_context:
  source_files: [".tmp/external-context.md", ".tmp/api-patterns.md"]
  extracted_patterns: {tech_stack, api_pattern, component_pattern, naming, standards, security}
  merge_with_existing: boolean

# For external context management
external_management:
  action: update | remove | clean_all | harvest
  target_files: [list of .tmp/ files]
  
frontmatter:
  context: project-intelligence/technical
  priority: critical  # @priority_assignment (80% use cases)
  version: {calculated}  # @version_tracking
  updated: {current_date}

validation:
  max_lines: 200  # @mvi_compliance
  has_frontmatter: true  # @frontmatter_required
  has_codebase_references: true  # @codebase_refs
  navigation_updated: true  # @navigation_update
```

### File Structure Inference

**Based on tech stack, infer common structure**:

Next.js: `src/app/ components/ lib/ db/`
React: `src/components/ hooks/ utils/ api/`
Express: `src/routes/ controllers/ models/ middleware/`

---

## Success Criteria

**User Experience**:
- [ ] Wizard complete <5 min
- [ ] Next steps clear
- [ ] Update process understood

**File Quality**:
- [ ] @mvi_compliance (<200 lines, <30s scannable)
- [ ] @frontmatter_required (HTML frontmatter)
- [ ] @codebase_refs (codebase references section)
- [ ] @priority_assignment (critical for tech stack)
- [ ] @version_tracking (1.0 new, incremented updates)

**System Integration**:
- [ ] @project_intelligence (technical-domain.md in project-intelligence/)
- [ ] @navigation_update (navigation.md updated)
- [ ] Agents load & use patterns
- [ ] No duplication

---

## Examples

### Example 1: First Time (No Context)
```bash
/add-context

# Q1: Next.js + TypeScript + PostgreSQL + Tailwind
# Q2: [pastes Next.js API route]
# Q3: [pastes React component]
# Q4-6: [answers]

✅ Created: technical-domain.md, navigation.md
```

### Example 2: Review & Update
```bash
/add-context

# Found existing → Choose "1. Review and update"
# Pattern 1: Tech Stack → Update (Next.js 14 → 15)
# Pattern 2-6: Keep

✅ Updated: Version 1.2 → 1.3
```

### Example 3: Quick Update
```bash
/add-context --tech-stack

# Current: Next.js 15 + TypeScript + PostgreSQL + Tailwind
# New: Next.js 15 + TypeScript + PostgreSQL + Drizzle + Tailwind

✅ Version 1.4 → 1.5
```

### Example 4: Extract External Context
```bash
/add-context

# Found external context files in .tmp/
#   📄 .tmp/external-context.md (2.4 KB)
#   📄 .tmp/api-patterns.md (1.8 KB)
# 
# Choose: 1. Extract & use these files
# 
# Extracted patterns:
#   ✓ Tech Stack: Next.js 15 + TypeScript + PostgreSQL + Tailwind
#   ✓ API Pattern: [from external-context.md]
#   ✓ Component: [from api-patterns.md]
#   ✓ Naming: kebab-case files, PascalCase components
#   ✓ Standards: TypeScript strict, Zod validation
#   ✓ Security: Input validation, parameterized queries
#
# ✅ Created: technical-domain.md (merged with external patterns)
```

### Example 5: Manage External Files
```bash
/add-context

# Found external context files in .tmp/
# Choose: 3. Manage external files
#
# Files in .tmp/:
#   A) .tmp/external-context.md (2.4 KB)
#   B) .tmp/api-patterns.md (1.8 KB)
#
# Choose file [A/B] then action [1/2/3/4/5]:
# A
# 1. Update file
#
# ✅ File updated. Ready to extract? [y/n]: y
# ✅ Patterns extracted and merged
```

### Example 6: Harvest External Context
```bash
/add-context

# Found external context files in .tmp/
# Choose: 4. Harvest (move to permanent context)
#
# To harvest external context files:
#   /context harvest
#
# This will:
#   ✓ Extract knowledge from .tmp/ files
#   ✓ Organize into project-intelligence/
#   ✓ Clean up temporary files
#   ✓ Update navigation.md
```

---

## Error Handling

**Invalid Input**:
```
⚠️ Invalid input
Expected: Tech stack description
Got: [empty]

Example: Next.js + TypeScript + PostgreSQL + Tailwind
```

**File Too Large**:
```
⚠️ Exceeds 200 lines (@mvi_compliance)
Current: 245 | Limit: 200

Simplify patterns or split into multiple files.
```

**Invalid Syntax**:
```
⚠️ Invalid code syntax in API pattern
Error: Unexpected token line 3

Check code & retry.
```

---

## Tips

**Keep Simple**: Focus on most common patterns, add more later
**Use Real Examples**: Paste actual code from YOUR project
**Update Regularly**: Run `/add-context --update` when patterns change
**Test After**: Build something simple to verify agents use patterns correctly

---

## Troubleshooting

**Q: Agents not using patterns?**
A: Check file exists, <200 lines. Run `/context validate`

**Q: See what's in context?**
A: `cat ~/.opencode/context/project-intelligence/technical-domain.md`

**Q: Multiple context files?**
A: Yes! Create in `~/.opencode/context/project-intelligence/`. Agents load all.

**Q: Remove pattern?**
A: Edit directly: `nano ~/.opencode/context/project-intelligence/technical-domain.md`

**Q: Share w/ team?**
A: Yes! Commit `~/.opencode/context/project-intelligence/` to repo.

**Q: Have external context files in .tmp/?**
A: Run `/add-context` and choose "Extract & use" or "Manage external files"

**Q: Want to clean up .tmp/ files?**
A: Run `/add-context` → "Manage external files" → "Clean all"

**Q: Move .tmp/ files to permanent context?**
A: Run `/context harvest` to extract and organize them

**Q: Update external context files?**
A: Run `/add-context` → "Manage external files" → "Update file"

**Q: Remove specific external file?**
A: Run `/add-context` → "Manage external files" → "Remove file"

---

## Related Commands

- `/context` - Manage context files (harvest, organize, validate)
- `/context validate` - Check integrity
- `/context map` - View structure
