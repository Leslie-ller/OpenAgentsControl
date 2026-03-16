#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR="/tmp/oac-test-runner-$$"
FAKE_BIN="$TEST_DIR/bin"
LOG_FILE="$TEST_DIR/npm.log"
PASSED=0
FAILED=0

pass() {
  echo -e "${GREEN}✓${NC} $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  FAILED=$((FAILED + 1))
}

cleanup() {
  rm -rf "$TEST_DIR"
}

trap cleanup EXIT

print_header() {
  echo -e "${CYAN}${BOLD}"
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║             Test Runner Argument Parsing Tests                ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

setup_fake_npm() {
  rm -rf "$TEST_DIR"
  mkdir -p "$FAKE_BIN" "$REPO_ROOT/evals/framework/node_modules"

  cat > "$FAKE_BIN/npm" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$LOG_FILE"
exit 0
EOF
  chmod +x "$FAKE_BIN/npm"
}

run_runner() {
  PATH="$FAKE_BIN:$PATH" bash "$REPO_ROOT/scripts/testing/test.sh" "$@" >/dev/null
}

assert_log_equals() {
  local expected="$1"
  local description="$2"
  local actual
  actual="$(tail -n 1 "$LOG_FILE" 2>/dev/null || true)"

  if [[ "$actual" == "$expected" ]]; then
    pass "$description"
  else
    fail "$description"
    echo "    expected: $expected"
    echo "    actual:   $actual"
  fi
}

test_core_flag_without_model() {
  : > "$LOG_FILE"
  run_runner openagent --core
  assert_log_equals \
    "run eval:sdk -- --agent=openagent --model=opencode/grok-code-fast --core" \
    "--core is preserved as a flag instead of being treated as model"
}

test_custom_model_with_flags() {
  : > "$LOG_FILE"
  run_runner openagent anthropic/claude-sonnet-4-5 --debug
  assert_log_equals \
    "run eval:sdk -- --agent=openagent --model=anthropic/claude-sonnet-4-5 --debug" \
    "explicit model is passed through with trailing flags"
}

test_all_agents_flag_only() {
  : > "$LOG_FILE"
  run_runner --core
  assert_log_equals \
    "run eval:sdk -- --model=opencode/grok-code-fast --core" \
    "flag-only invocation keeps default agent and model"
}

main() {
  print_header
  setup_fake_npm

  test_core_flag_without_model
  test_custom_model_with_flags
  test_all_agents_flag_only

  echo ""
  if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed (${PASSED} assertions).${NC}"
    exit 0
  fi

  echo -e "${RED}${FAILED} test(s) failed, ${PASSED} passed.${NC}"
  exit 1
}

main "$@"
