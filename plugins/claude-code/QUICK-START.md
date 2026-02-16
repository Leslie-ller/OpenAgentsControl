# OAC Plugin - Quick Start

**Status**: ✅ Ready to test locally  
**Version**: 1.0.0  
**Date**: 2026-02-16

---

## ✅ What's Been Created

```
OpenAgentsControl/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog
│
└── claude-plugin/
    ├── .claude-plugin/
    │   └── plugin.json           # Plugin manifest (name: "oac")
    ├── skills/
    │   └── hello/
    │       └── SKILL.md          # Test skill
    ├── agents/                   # (empty - ready for future agents)
    ├── hooks/                    # (empty - ready for future hooks)
    ├── commands/                 # (empty - ready for future commands)
    ├── context -> ../.opencode/context/  # Symlink to shared context
    ├── README.md                 # Full documentation
    ├── INSTALL.md                # Installation guide
    └── QUICK-START.md            # This file
```

---

## 🚀 Test It Now (Local)

```bash
# 1. Make sure you're in the repo root
cd /path/to/OpenAgentsControl

# 2. Start Claude with the plugin
claude --plugin-dir ./plugins/claude-code

# 3. In Claude Code, test the plugin
/oac:hello
```

**Expected output**: A friendly message confirming the OAC plugin is working.

---

## 📦 Publish to GitHub (Next Step)

Once you've tested locally and it works:

```bash
# 1. Add the files
git add claude-plugin/ .claude-plugin/

# 2. Commit
git commit -m "feat: add Claude Code plugin (OAC)"

# 3. Push
git push origin main

# 4. Users can then install via marketplace
# /plugin marketplace add darrenhinde/OpenAgentsControl
# /plugin install oac
```

---

## 🎯 Available Commands (After Install)

- `/oac:hello` - Test skill to verify plugin is working

---

## 🔜 Coming Soon

### Skills to Add
- `/oac:code-review` - Intelligent code review
- `/oac:test` - TDD-driven test creation
- `/oac:docs` - Documentation generation
- `/oac:task-breakdown` - Feature decomposition
- `/oac:context-scout` - Smart context discovery

### Hooks to Add
- Auto-format on file write
- Auto-commit after changes
- Test runner on save
- Documentation sync

### Agents to Add
- Code Reviewer
- Test Engineer
- Doc Writer
- Task Manager

---

## 📝 How to Add More Skills

1. **Create skill directory**:
   ```bash
   mkdir -p claude-plugin/skills/my-skill
   ```

2. **Create SKILL.md**:
   ```markdown
   # My Skill
   
   Description of what this skill does.
   
   ```claude
   You are a helpful assistant that...
   ```
   ```

3. **Test it**:
   ```bash
   claude --plugin-dir ./plugins/claude-code
   /oac:my-skill
   ```

4. **Commit and push**:
   ```bash
   git add claude-plugin/skills/my-skill/
   git commit -m "feat: add my-skill to OAC plugin"
   git push
   ```

---

## 🔗 Key Files

| File | Purpose |
|------|---------|
| `claude-plugin/.claude-plugin/plugin.json` | Plugin metadata (name, version, etc.) |
| `claude-plugin/skills/*/SKILL.md` | Skill definitions |
| `claude-plugin/context` | Symlink to shared context |
| `.claude-plugin/marketplace.json` | Marketplace catalog |

---

## 🆘 Troubleshooting

### "Plugin not found"
- Check you're in the repo root
- Verify: `ls claude-plugin/.claude-plugin/plugin.json`

### "Skill not working"
- Check: `ls claude-plugin/skills/hello/SKILL.md`
- Restart Claude Code

### "Context not loading"
- Verify symlink: `ls -la claude-plugin/context`
- Should show: `context -> ../.opencode/context`

---

## 📚 Documentation

- **Full README**: `claude-plugin/README.md`
- **Installation Guide**: `claude-plugin/INSTALL.md`
- **Main Repo Docs**: `.opencode/docs/`
- **Planning Docs**: `docs/planning/`

---

## ✅ Next Steps

1. **Test locally** (see above)
2. **Add more skills** (code-review, test, docs)
3. **Push to GitHub**
4. **Share with users**

---

**Ready to test!** 🎉

Run: `claude --plugin-dir ./plugins/claude-code` and then `/oac:hello`
