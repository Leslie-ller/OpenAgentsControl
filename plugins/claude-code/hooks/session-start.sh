#!/usr/bin/env bash
# SessionStart hook for OAC plugin

set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_FILE="${PLUGIN_ROOT}/skills/using-oac/SKILL.md"

# Read using-oac content
using_oac_content=$(cat "${SKILL_FILE}" 2>&1 || echo "Error reading using-oac skill")

# Escape string for JSON embedding using bash parameter substitution
# Each ${s//old/new} is a single C-level pass - orders of magnitude
# faster than character-by-character loop
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

using_oac_escaped=$(escape_for_json "$using_oac_content")

# Build warning message for first-time users
warning_message=""
if [[ ! -f ".context-manifest.json" ]]; then
    warning_message="\n\n<important-reminder>IN YOUR FIRST REPLY AFTER SEEING THIS MESSAGE YOU MUST TELL THE USER:👋 **Welcome to OpenAgents Control!** To get started, run /oac:setup to download context files. Then use /oac:help to learn the 6-stage workflow.</important-reminder>"
fi

warning_escaped=$(escape_for_json "$warning_message")

# Output context injection as JSON
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\nYou are using OpenAgents Control (OAC).\n\n**Below is the full content of your 'using-oac' skill - your guide to the 6-stage workflow. For all other skills, use the 'Skill' tool:**\n\n${using_oac_escaped}\n\n${warning_escaped}\n</EXTREMELY_IMPORTANT>"
  }
}
EOF

exit 0
