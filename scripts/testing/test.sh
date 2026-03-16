#!/bin/bash
# Advanced test runner with multi-agent support
# Usage: ./scripts/testing/test.sh [agent] [model] [options]
# Examples:
#   ./scripts/testing/test.sh openagent --core                    # Run core tests
#   ./scripts/testing/test.sh openagent opencode/grok-code-fast   # Run all tests with specific model
#   ./scripts/testing/test.sh openagent --core --debug            # Run core tests with debug

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Defaults
AGENT="all"
MODEL="opencode/grok-code-fast"
EXTRA_ARGS=()

# First positional argument is the agent unless it is a flag.
if [[ $# -gt 0 && "$1" != --* ]]; then
  AGENT="$1"
  shift
fi

# Second positional argument is the model only when it is not a flag.
if [[ $# -gt 0 && "$1" != --* ]]; then
  MODEL="$1"
  shift
fi

EXTRA_ARGS=("$@")

# Check if --core flag is present
CORE_MODE=false
for arg in "${EXTRA_ARGS[@]}"; do
  if [[ "$arg" == "--core" ]]; then
    CORE_MODE=true
    break
  fi
done

echo -e "${BLUE}🧪 OpenCode Agents Test Runner${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
if [ "$CORE_MODE" = true ]; then
  echo -e "Mode:   ${YELLOW}CORE TEST SUITE (7 tests, ~5-8 min)${NC}"
fi
echo -e "Agent:  ${GREEN}${AGENT}${NC}"
echo -e "Model:  ${GREEN}${MODEL}${NC}"
if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
  echo -e "Extra:  ${YELLOW}${EXTRA_ARGS[*]}${NC}"
fi
echo ""

# Navigate to framework directory
cd "$(dirname "$0")/../../evals/framework" || exit 1

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠️  Dependencies not installed. Running npm install...${NC}"
  npm install
  echo ""
fi

# Run tests
set +e
if [ "$AGENT" = "all" ]; then
  echo -e "${YELLOW}Running tests for ALL agents...${NC}"
  npm run eval:sdk -- --model="$MODEL" "${EXTRA_ARGS[@]}"
else
  echo -e "${YELLOW}Running tests for ${AGENT}...${NC}"
  npm run eval:sdk -- --agent="$AGENT" --model="$MODEL" "${EXTRA_ARGS[@]}"
fi
EXIT_CODE=$?
set -e

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Tests complete!${NC}"
else
  echo -e "${RED}❌ Tests failed with exit code ${EXIT_CODE}${NC}"
fi
echo -e "${BLUE}View results: npm run dashboard${NC}"
echo ""

exit $EXIT_CODE
