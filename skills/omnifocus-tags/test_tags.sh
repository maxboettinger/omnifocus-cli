#!/usr/bin/env bash
# test_tags.sh — Integration tests for OmniFocus tag management scripts
#
# Requires: OmniFocus running, jq installed
# Creates and cleans up a test tag: __TEST_TAG_DO_NOT_USE__
#
# Usage: bash omnifocus-tags/test_tags.sh

set -euo pipefail

SCRIPTS_DIR="/Users/max/.skills/openclaw/omnifocus/scripts"
PASS=0
FAIL=0
TEST_TAG="__TEST_TAG_DO_NOT_USE__"
TEST_TAG_RENAMED="__TEST_TAG_RENAMED__"

# ── Helpers ─────────────────────────────────────────────────

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1: $2"; FAIL=$((FAIL + 1)); }

assert_ok() {
    local result="$1" desc="$2"
    if echo "$result" | jq -e '.ok == true' >/dev/null 2>&1; then
        pass "$desc"
    else
        local err
        err=$(echo "$result" | jq -r '.error // "unknown"' 2>/dev/null)
        fail "$desc" "expected ok=true, got error: $err"
    fi
}

assert_err() {
    local result="$1" desc="$2"
    if echo "$result" | jq -e '.ok == false' >/dev/null 2>&1; then
        pass "$desc"
    elif echo "$result" | jq -e '.error' >/dev/null 2>&1; then
        pass "$desc"
    else
        fail "$desc" "expected error, got ok"
    fi
}

assert_json_array() {
    local result="$1" desc="$2"
    if echo "$result" | jq -e 'type == "array"' >/dev/null 2>&1; then
        pass "$desc"
    else
        fail "$desc" "expected JSON array"
    fi
}

assert_contains() {
    local result="$1" pattern="$2" desc="$3"
    if echo "$result" | grep -q "$pattern"; then
        pass "$desc"
    else
        fail "$desc" "output does not contain '$pattern'"
    fi
}

assert_not_contains() {
    local result="$1" pattern="$2" desc="$3"
    if echo "$result" | grep -q "$pattern"; then
        fail "$desc" "output unexpectedly contains '$pattern'"
    else
        pass "$desc"
    fi
}

# ── Cleanup helper ──────────────────────────────────────────

cleanup_test_tags() {
    # Best-effort cleanup of test tags
    osascript -l JavaScript "$SCRIPTS_DIR/delete_tag.js" "$TEST_TAG" --confirm >/dev/null 2>&1 || true
    osascript -l JavaScript "$SCRIPTS_DIR/delete_tag.js" "$TEST_TAG_RENAMED" --confirm >/dev/null 2>&1 || true
}

# ── Pre-flight ──────────────────────────────────────────────

echo "=== OmniFocus Tag Management Tests ==="
echo ""

# Check prerequisites
if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is required but not installed"
    exit 1
fi

if ! command -v osascript &>/dev/null; then
    echo "ERROR: osascript not found (macOS required)"
    exit 1
fi

# Clean up any leftover test tags from previous runs
cleanup_test_tags

# ── Test: list_tags.js ──────────────────────────────────────

echo "--- list_tags.js ---"

# T1: Default output is a JSON array of strings (compact)
result=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" 2>&1)
assert_json_array "$result" "T1: default output is JSON array"

# T2: Array elements are strings (tag names), not objects
first_type=$(echo "$result" | jq -r '.[0] | type' 2>/dev/null)
if [ "$first_type" = "string" ]; then
    pass "T2: default elements are strings (compact)"
else
    fail "T2: default elements are strings (compact)" "got type: $first_type"
fi

# T3: --count returns objects with name and taskCount
result_count=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --count 2>&1)
has_count=$(echo "$result_count" | jq -e '.[0] | has("name") and has("taskCount")' 2>/dev/null)
if [ "$has_count" = "true" ]; then
    pass "T3: --count returns objects with name and taskCount"
else
    fail "T3: --count returns objects with name and taskCount" "missing fields"
fi

# T4: --search filters results
result_search=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "Daheim" 2>&1)
assert_json_array "$result_search" "T4: --search returns JSON array"
assert_contains "$result_search" "Daheim" "T4b: --search finds matching tags"

# T5: --search with no match returns empty array
result_nomatch=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "ZZZZNONEXISTENT99" 2>&1)
length=$(echo "$result_nomatch" | jq 'length' 2>/dev/null)
if [ "$length" = "0" ]; then
    pass "T5: --search with no match returns empty array"
else
    fail "T5: --search with no match returns empty array" "got $length results"
fi

# T6: --active-only returns only tags with tasks
result_active=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --active-only --count 2>&1)
all_have_tasks=$(echo "$result_active" | jq -e 'all(.[]; .taskCount > 0)' 2>/dev/null)
if [ "$all_have_tasks" = "true" ]; then
    pass "T6: --active-only returns only tags with incomplete tasks"
else
    fail "T6: --active-only returns only tags with incomplete tasks" "some have 0 tasks"
fi

# T7: --limit caps results
result_limited=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --limit 3 2>&1)
limited_length=$(echo "$result_limited" | jq 'length' 2>/dev/null)
if [ "$limited_length" -le 3 ] 2>/dev/null; then
    pass "T7: --limit caps results"
else
    fail "T7: --limit caps results" "got $limited_length results"
fi

echo ""

# ── Test: create_tag.js ─────────────────────────────────────

echo "--- create_tag.js ---"

# T8: Create new tag succeeds
result=$(osascript -l JavaScript "$SCRIPTS_DIR/create_tag.js" "$TEST_TAG" 2>&1)
assert_ok "$result" "T8: create new tag succeeds"

# T9: Create duplicate tag fails
result_dup=$(osascript -l JavaScript "$SCRIPTS_DIR/create_tag.js" "$TEST_TAG" 2>&1)
assert_err "$result_dup" "T9: create duplicate tag fails"

# T10: Created tag appears in list
result_list=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "$TEST_TAG" 2>&1)
assert_contains "$result_list" "$TEST_TAG" "T10: created tag appears in list"

# T11: No args returns error
result_noargs=$(osascript -l JavaScript "$SCRIPTS_DIR/create_tag.js" 2>&1)
assert_err "$result_noargs" "T11: create with no args returns error"

echo ""

# ── Test: rename_tag.js ─────────────────────────────────────

echo "--- rename_tag.js ---"

# T12: Rename existing tag succeeds
result=$(osascript -l JavaScript "$SCRIPTS_DIR/rename_tag.js" "$TEST_TAG" --name "$TEST_TAG_RENAMED" 2>&1)
assert_ok "$result" "T12: rename existing tag succeeds"

# T13: Old name no longer in list
result_old=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "$TEST_TAG" 2>&1)
# The renamed tag shouldn't match the old exact name
old_exact=$(echo "$result_old" | jq -r ".[] | select(. == \"$TEST_TAG\")" 2>/dev/null)
if [ -z "$old_exact" ]; then
    pass "T13: old tag name no longer exists"
else
    fail "T13: old tag name no longer exists" "still found: $old_exact"
fi

# T14: New name appears in list
result_new=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "$TEST_TAG_RENAMED" 2>&1)
assert_contains "$result_new" "$TEST_TAG_RENAMED" "T14: new tag name appears in list"

# T15: Rename nonexistent tag fails
result_noexist=$(osascript -l JavaScript "$SCRIPTS_DIR/rename_tag.js" "NONEXISTENT_TAG_XYZ" --name "Whatever" 2>&1)
assert_err "$result_noexist" "T15: rename nonexistent tag fails"

# T16: Rename to existing name fails
# First create the old name again so both exist
osascript -l JavaScript "$SCRIPTS_DIR/create_tag.js" "$TEST_TAG" >/dev/null 2>&1 || true
result_conflict=$(osascript -l JavaScript "$SCRIPTS_DIR/rename_tag.js" "$TEST_TAG" --name "$TEST_TAG_RENAMED" 2>&1)
assert_err "$result_conflict" "T16: rename to existing name fails"

# Clean up the extra tag
osascript -l JavaScript "$SCRIPTS_DIR/delete_tag.js" "$TEST_TAG" --confirm >/dev/null 2>&1 || true

echo ""

# ── Test: apply_tag.js ──────────────────────────────────────

echo "--- apply_tag.js ---"

# T17: Apply nonexistent tag fails (THE KEY BEHAVIORAL TEST)
result=$(osascript -l JavaScript "$SCRIPTS_DIR/apply_tag.js" "NONEXISTENT_TASK" --tag "NONEXISTENT_TAG_XYZ" 2>&1)
assert_err "$result" "T17: apply nonexistent tag fails (no auto-create)"

# T18: Verify nonexistent tag was NOT created
result_check=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "NONEXISTENT_TAG_XYZ" 2>&1)
check_len=$(echo "$result_check" | jq 'length' 2>/dev/null)
if [ "$check_len" = "0" ]; then
    pass "T18: nonexistent tag was NOT auto-created"
else
    fail "T18: nonexistent tag was NOT auto-created" "tag was created!"
fi

# T19: No args returns error
result_noargs=$(osascript -l JavaScript "$SCRIPTS_DIR/apply_tag.js" 2>&1)
assert_err "$result_noargs" "T19: apply_tag with no args returns error"

# T20: Apply without --tag returns error
result_notag=$(osascript -l JavaScript "$SCRIPTS_DIR/apply_tag.js" "some task" 2>&1)
assert_err "$result_notag" "T20: apply_tag without --tag returns error"

echo ""

# ── Test: delete_tag.js ─────────────────────────────────────

echo "--- delete_tag.js ---"

# T21: Delete without --confirm fails (safety check)
result=$(osascript -l JavaScript "$SCRIPTS_DIR/delete_tag.js" "$TEST_TAG_RENAMED" 2>&1)
assert_err "$result" "T21: delete without --confirm fails"

# T22: Verify tag still exists after failed delete
result_still=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "$TEST_TAG_RENAMED" 2>&1)
assert_contains "$result_still" "$TEST_TAG_RENAMED" "T22: tag still exists after delete without --confirm"

# T23: Delete with --confirm succeeds
result_del=$(osascript -l JavaScript "$SCRIPTS_DIR/delete_tag.js" "$TEST_TAG_RENAMED" --confirm 2>&1)
assert_ok "$result_del" "T23: delete with --confirm succeeds"

# T24: Deleted tag no longer in list
result_gone=$(osascript -l JavaScript "$SCRIPTS_DIR/list_tags.js" --search "$TEST_TAG_RENAMED" 2>&1)
gone_len=$(echo "$result_gone" | jq 'length' 2>/dev/null)
if [ "$gone_len" = "0" ]; then
    pass "T24: deleted tag no longer in list"
else
    fail "T24: deleted tag no longer in list" "still found"
fi

# T25: Delete nonexistent tag fails
result_noexist=$(osascript -l JavaScript "$SCRIPTS_DIR/delete_tag.js" "NONEXISTENT_TAG_XYZ" --confirm 2>&1)
assert_err "$result_noexist" "T25: delete nonexistent tag fails"

echo ""

# ── Final cleanup ───────────────────────────────────────────

cleanup_test_tags

# ── Summary ─────────────────────────────────────────────────

echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "SOME TESTS FAILED"
    exit 1
else
    echo "ALL TESTS PASSED"
    exit 0
fi
