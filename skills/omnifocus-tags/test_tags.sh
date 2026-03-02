#!/usr/bin/env bash
# Smoke tests for tag flows via omnifocus-cli (`of`)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

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

TEST_TAG="__TEST_TAG_$$"
TEST_TAG_RENAMED="${TEST_TAG}_RENAMED"

cleanup() {
  of tag delete "$TEST_TAG" --confirm --json >/dev/null 2>&1 || true
  of tag delete "$TEST_TAG_RENAMED" --confirm --json >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

echo "[1/5] create tag"
of tag add "$TEST_TAG" --json | jq -e '.id and .name' >/dev/null

echo "[2/5] list/search tag"
of tag list --search "$TEST_TAG" --json | jq -e 'length >= 1' >/dev/null

echo "[3/5] rename tag"
of tag rename "$TEST_TAG" "$TEST_TAG_RENAMED" --json | jq -e '.oldName and .newName' >/dev/null

echo "[4/5] verify renamed tag exists"
of tag list --search "$TEST_TAG_RENAMED" --json | jq -e 'length >= 1' >/dev/null

echo "[5/5] delete tag"
of tag delete "$TEST_TAG_RENAMED" --confirm --json | jq -e '.deleted == true' >/dev/null

echo "Tag smoke tests passed."
