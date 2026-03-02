#!/usr/bin/env bash
# Smoke tests for task flows via omnifocus-cli (`of`)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

of() {
  bun "$ROOT_DIR/src/index.ts" "$@"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require bun
require jq

TEST_NAME="__TEST_TASK_$$"
TASK_ID=""

cleanup() {
  if [[ -n "$TASK_ID" ]]; then
    of task complete --id "$TASK_ID" --json >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[1/5] create task"
create_json="$(of task add "$TEST_NAME" --note "smoke test" --estimate 5 --json)"
TASK_ID="$(echo "$create_json" | jq -r '.id')"
[[ -n "$TASK_ID" && "$TASK_ID" != "null" ]]

echo "[2/5] search task"
of task search "$TEST_NAME" --json | jq -e 'length >= 1' >/dev/null

echo "[3/5] update task"
of task update --id "$TASK_ID" --flag --json | jq -e '.id and (.changes | length >= 1)' >/dev/null

echo "[4/5] show task"
of task show --id "$TASK_ID" --json | jq -e '.id == "'"$TASK_ID"'"' >/dev/null

echo "[5/5] complete task"
of task complete --id "$TASK_ID" --json | jq -e '.action == "completed"' >/dev/null

TASK_ID=""
echo "Task smoke tests passed."
