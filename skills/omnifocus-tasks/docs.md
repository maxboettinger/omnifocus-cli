# Noridoc: omnifocus-tasks

Path: @/omnifocus-tasks

### Overview

Consolidated documentation for all OmniFocus task operations including CRUD (create, read, update, complete), search/filtering, subtask hierarchy management, and bulk operations. This is a pure documentation skill — all scripts live in `@/omnifocus/scripts/` and use the shared `_omnifocus_lib.js` library.

### How it fits into the larger codebase

This skill consolidates documentation for task operations that were previously scattered across multiple skills. It follows the pattern established by `@/omnifocus-tags` and `@/omnifocus-projects` — focused, comprehensive documentation with strict validation patterns.

```
 omnifocus-inbox ────┐
 omnifocus-create ───┤
 omnifocus-process ──┼──► @/omnifocus-tasks/SKILL.md ──► @/omnifocus/scripts/*.js ──► OmniFocus.app
 omnifocus-forecast ─┤     (documentation)                 (implementation)
 omnifocus-plan ─────┘
```

**Upstream consumers:**
- `@/omnifocus-inbox` routes task creation here
- `@/omnifocus-create` structures tasks before routing here
- `@/omnifocus-process` uses search/update/complete for inbox triage
- `@/omnifocus-forecast` uses list/search for daily planning
- `@/omnifocus-plan` uses update for time estimation

**Implementation location:** All task scripts live in `@/omnifocus/scripts/` (not in this directory). This skill only provides documentation.

**Shared dependencies:**
- `@/omnifocus/scripts/_omnifocus_lib.js` — Shared JXA library for all OmniFocus operations
- `@/omnifocus/references/taxonomy-reference.md` — Emoji taxonomy, spoon costs, priority system
- `@/omnifocus-tags` — Tag management (strict lookup, never creates)
- `@/omnifocus-projects` — Project management (strict lookup, never creates)

### Core Implementation

**Progressive disclosure pattern:** All operations support simple defaults (just a task name) with optional metadata (due dates, tags, estimates, flags). Complex options are available but not required.

**Script organization:**

| Category | Scripts | Purpose |
|----------|---------|---------|
| Create | `add_task.js`, `add_subtask.js` | Task creation with full metadata, nested subtasks |
| Read | `search_tasks.js`, `list_tasks.js` | Search by keyword, filter by status (available/flagged/overdue/due-soon) |
| Update | `update_task.js` | Modify any property (name, note, dates, tags, flags, project) |
| Complete | `complete_task.js` | Mark complete/incomplete |
| Bulk | `bulk_create_tasks.js`, `bulk_update_tasks.js`, `bulk_complete_tasks.js` | Batch operations |

**Bulk operations accept JSON from stdin:**
- `bulk_create_tasks.js` — Array of task objects `[{name, due?, tags?, ...}, ...]`
- `bulk_update_tasks.js` — Array of update objects `[{id, due?, note?, ...}, ...]`
- `bulk_complete_tasks.js` — Array of task IDs `["id1", "id2", ...]`

**Error handling:** All scripts return `{ok: true/false, ...}` JSON. On failure, includes `error` message. On ambiguous lookup (multiple matches), includes `candidates` array with IDs for disambiguation.

**Strict validation pattern:**
- Tags: Uses `findExistingTag()` — never creates, returns candidates on ambiguity
- Projects: Uses `findExistingProject()` — never creates, returns candidates on ambiguity
- Task lookup: Tries ID first (exact), then name match (exact), then substring (with disambiguation)

**Subtask hierarchy:** Supports arbitrary nesting depth using `add_subtask.js` with `--parent` (name) or `--parent-id` (ID). Follows taxonomy Package (📦) → Task (🗂️) → Step (👣) pattern.

### Things to Know

**Bulk operations continue on individual failures.** If 1 of 10 tasks fails to create, the other 9 succeed and the response array includes both successes and failures. This enables resilient batch processing.

**All date parsing is local timezone.** Dates like `2026-03-01` are parsed as midnight in the user's timezone. Datetime format `2026-03-01T14:30` sets specific times.

**54 integration tests in `tests/test_tasks.sh`.** Tests run against live OmniFocus and create/cleanup `__TEST_TASK_*` prefixed items. Tests verify JSON structure, error handling, disambiguation, edge cases (empty names, Unicode, special characters).

**Task lookup cascade is performance-optimized.** `findTaskByQuery()` tries fast paths first: ID lookup via `flattenedTasks.byId()`, then batch name matching, then substring search. This handles large task databases efficiently.

**This skill was created during PR to consolidate scattered documentation.** Previously, task operations were documented in base `@/omnifocus/SKILL.md` mixed with other operations. This split improves discoverability and follows the pattern of specialized skills like `@/omnifocus-tags`.

**Script location is absolute path.** All scripts use hardcoded path `/Users/max/.skills/openclaw/omnifocus/scripts/` for loading `_omnifocus_lib.js`. If repository moves, scripts break.

Created and maintained by Nori.
