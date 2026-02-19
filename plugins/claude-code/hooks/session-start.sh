#!/usr/bin/env bash
# SessionStart hook for OAC plugin

set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_FILE="${PLUGIN_ROOT}/skills/using-oac/SKILL.md"

# Read using-oac content
using_oac_content=$(cat "${SKILL_FILE}" 2>&1 || echo "Error reading using-oac skill")

# Escape string for JSON embedding
# SECURITY: Prevents command injection attacks from malicious SKILL.md files
escape_for_json() {
    local s="$1"
    # Escape backslashes FIRST - order matters!
    s="${s//\\/\\\\}"
    # Escape double quotes
    s="${s//\"/\\\"}"
    # Escape newlines, carriage returns, tabs
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

using_oac_escaped=$(escape_for_json "$using_oac_content")

# Build skill catalogue from skills directory
skill_catalogue=""
if [ -d "${PLUGIN_ROOT}/skills" ]; then
    for skill_dir in "${PLUGIN_ROOT}/skills"/*/; do
        skill_name=$(basename "$skill_dir")
        skill_file="${skill_dir}SKILL.md"
        if [ -f "$skill_file" ]; then
            # Extract description from frontmatter
            description=$(grep -m1 '^description:' "$skill_file" 2>/dev/null | sed 's/^description: *//;s/^"//;s/"$//' || echo "")
            if [ -n "$description" ]; then
                skill_catalogue="${skill_catalogue}\n- oac:${skill_name} — ${description}"
            else
                skill_catalogue="${skill_catalogue}\n- oac:${skill_name}"
            fi
        fi
    done
fi

# Build warning message for first-time users
warning_message=""
if [[ ! -f "${PLUGIN_ROOT}/.context-manifest.json" ]] && [[ ! -f "$(pwd)/.context-manifest.json" ]]; then
    warning_message="\n\n<important-reminder>IN YOUR FIRST REPLY AFTER SEEING THIS MESSAGE YOU MUST TELL THE USER:👋 **Welcome to OpenAgents Control!** To get started, run /install-context to download context files. Then use /brainstorm before building anything.</important-reminder>"
fi

warning_escaped=$(escape_for_json "$warning_message")
skill_catalogue_escaped=$(escape_for_json "$skill_catalogue")

# Build context string
OAC_CONTEXT="<EXTREMELY_IMPORTANT>\nYou have OAC (OpenAgents Control) superpowers.\n\n**Below is the full content of your 'oac:using-oac' skill — your introduction to using OAC skills. For all other skills, use the 'Skill' tool:**\n\n${using_oac_escaped}\n\n## Available OAC Skills (invoke with the Skill tool):\n${skill_catalogue_escaped}\n\n${warning_escaped}\n</EXTREMELY_IMPORTANT>"

# Output dual-format JSON for cross-tool compatibility
# - additionalContext: Claude Code (hookSpecificOutput)
# - additional_context: Cursor / OpenCode / other tools
cat <<EOF
{
  "additional_context": "${OAC_CONTEXT}",
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${OAC_CONTEXT}"
  }
}
EOF

exit 0
