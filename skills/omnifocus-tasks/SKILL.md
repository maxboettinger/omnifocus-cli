---
name: omnifocus-tasks
description: "Raw OmniFocus CRUD operations — create, read, update, complete, search, filter, and bulk-operate on tasks. This is the LOW-LEVEL script reference. For adding new tasks (from brain dumps, emails, conversations, or user requests like 'add this to OmniFocus'), use `omnifocus-inbox` instead — it handles taxonomy classification, emoji decoration, spoon assessment, and proper tagging. Only use this skill for direct CRUD when you already know exactly what to create/update/search."
---

# OmniFocus Task Management (Low-Level CRUD)

Raw task operations for OmniFocus. Scripts, flags, and API reference.

> **⚠️ ROUTING GUARD:** If the task needs *classification, decoration, or spoon assessment* (i.e., any user request to "add", "create", "hinzufügen", or "anlegen" a task), **STOP and load `omnifocus-inbox/SKILL.md` instead.** This skill is for raw script operations only — it does NOT apply taxonomy, emoji decorations, or proper tagging.

<required>
*CRITICAL* Add the following steps to your Todo list using TodoWrite:

1. Identify task operation needed (create, update, search, bulk)
2. Use simple command first with required parameters only
3. Add optional metadata as needed (due, tags, estimates)
4. Verify operation with search or list command
5. For bulk operations, prepare JSON input with required fields
</required>

## Why This Skill Exists

All OmniFocus task scripts follow consistent patterns: strict validation, progressive disclosure, structured JSON output. This skill consolidates documentation for CRUD operations (Create, Read, Update, Delete/Complete), subtask hierarchy, search/filtering, and bulk operations. Scripts live in `omnifocus/scripts/` and use shared library (`_omnifocus_lib.js`) for DRY principles.

## Quick Reference

| Script | Purpose | Key Flags | Token-Efficient Example |
|--------|---------|-----------|-------------------------|
| `add_task.js` | Create task with metadata | `--due --tag --flag --estimate --project` | `add_task.js "Task" --due "2026-03-01"` |
| `add_subtask.js` | Create nested subtask | `--parent --parent-id` | `add_subtask.js "Step" --parent-id "abc123"` |
| `update_task.js` | Update task properties | `--id --name --note --due --tag` | `update_task.js --id "xyz" --due "2026-03-15"` |
| `complete_task.js` | Complete/uncomplete | `--id --incomplete` | `complete_task.js --id "abc123"` |
| `search_tasks.js` | Search by keyword | (positional: query) | `search_tasks.js "keyword"` |
| `list_tasks.js` | Filter by status | (positional: filter) | `list_tasks.js flagged` |
| `bulk_create_tasks.js` | Batch create | (stdin: JSON array) | `echo '[...]' \| bulk_create_tasks.js` |
| `bulk_update_tasks.js` | Batch update | (stdin: JSON array) | `echo '[...]' \| bulk_update_tasks.js` |
| `bulk_complete_tasks.js` | Batch complete | (stdin: ID array) | `echo '["id1","id2"]' \| bulk_complete_tasks.js` |

## Core Operations

### Create Task (`add_task.js`)

Create tasks with full metadata support. Can create in inbox or directly in project.

**Basic Usage:**
```bash
osascript -l JavaScript scripts/add_task.js "Task name"
```

**With Metadata:**
```bash
osascript -l JavaScript scripts/add_task.js "Task name" \
  --due "2026-03-01" \
  --defer "2026-02-15" \
  --tag "🔴 P1" \
  --flag \
  --estimate 30 \
  --project "Work"
```

**Options:**

| Flag | Type | Description |
|------|------|-------------|
| `--note "text"` | string | Task note/context |
| `--due YYYY-MM-DD` | date | Due date (or YYYY-MM-DDTHH:MM) |
| `--defer YYYY-MM-DD` | date | Defer/start date |
| `--planned YYYY-MM-DD` | date | Planned date (OmniFocus 4.7+ "Plan for Today") |
| `--tag "name"` | string (repeatable) | Add existing tag (strict: never creates) |
| `--flag` | boolean | Flag the task |
| `--estimate N` | int | Estimated minutes |
| `--project "name"` | string | Create in project (not inbox) |
| `--sequential` | boolean | Set children to sequential |
| `--repeat "RRULE"` | string | Repetition rule (e.g., "FREQ=DAILY;INTERVAL=1") |
| `--repeat-method "due-date\|completion"` | string | Repeat method |

**Response:**
```json
{
  "ok": true,
  "id": "taskId",
  "name": "Task name",
  "task": { /* full task object with all metadata */ }
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Error message",
  "candidates": [ /* suggestions if ambiguous */ ]
}
```

### Read Tasks

#### Search by Keyword (`search_tasks.js`)

Search task names and notes (case-insensitive substring match).

**Usage:**
```bash
osascript -l JavaScript scripts/search_tasks.js "keyword" [limit]
```

**Examples:**
```bash
# Search for "groceries"
osascript -l JavaScript scripts/search_tasks.js "groceries"

# Search with limit
osascript -l JavaScript scripts/search_tasks.js "meeting" 10
```

**Response:** JSON array of matching tasks (incomplete only)

#### Filter by Status (`list_tasks.js`)

List tasks with various filters.

**Usage:**
```bash
osascript -l JavaScript scripts/list_tasks.js [filter] [limit]
```

**Filters:**

| Filter | Description | Default Limit |
|--------|-------------|---------------|
| `inbox` | Inbox tasks | 500 |
| `available` | Available (unblocked) tasks | 20 |
| `flagged` | Flagged tasks | 20 |
| `due-soon` | Due within 3 days | 20 |
| `overdue` | Past due | 20 |
| `all` | All incomplete tasks | 20 |

**Examples:**
```bash
# List inbox tasks
osascript -l JavaScript scripts/list_tasks.js inbox

# List flagged with custom limit
osascript -l JavaScript scripts/list_tasks.js flagged 50

# List all available tasks
osascript -l JavaScript scripts/list_tasks.js available
```

**Response:** JSON array of task objects

### Update Task (`update_task.js`)

Update any task property with full metadata support.

**Basic Usage:**
```bash
# By name (exact or substring match)
osascript -l JavaScript scripts/update_task.js "Task name" --due "2026-03-15"

# By ID (most reliable)
osascript -l JavaScript scripts/update_task.js --id "taskId" --flag
```

**Options:**

| Flag | Type | Description |
|------|------|-------------|
| `--id "taskId"` | string | Find by task ID (most reliable) |
| `--name "new name"` | string | Rename the task |
| `--note "text"` | string | Set/replace note |
| `--note-append "text"` | string | Append to existing note |
| `--due YYYY-MM-DD\|clear` | date/clear | Set or clear due date |
| `--defer YYYY-MM-DD\|clear` | date/clear | Set or clear defer date |
| `--planned YYYY-MM-DD\|clear` | date/clear | Set or clear planned date |
| `--flag` | boolean | Flag the task |
| `--unflag` | boolean | Unflag the task |
| `--estimate N\|clear` | int/clear | Set or clear estimate (minutes) |
| `--tag "name"` | string (repeatable) | Add existing tag (strict: never creates) |
| `--remove-tag "name"` | string (repeatable) | Remove tag |
| `--project "name"` | string | Move to project |
| `--sequential` | boolean | Set children to sequential |
| `--parallel` | boolean | Set children to parallel |
| `--repeat "RRULE"\|clear` | string/clear | Set or clear repetition |
| `--repeat-method "due-date\|completion"` | string | Repeat method |
| `--complete` | boolean | Mark task complete |
| `--incomplete` | boolean | Mark task incomplete |

**Response:**
```json
{
  "ok": true,
  "id": "taskId",
  "changes": ["renamed → New name", "due: 2026-03-15", "flagged"],
  "task": { /* full task object */ }
}
```

**Examples:**
```bash
# Update due date and flag
osascript -l JavaScript scripts/update_task.js "Buy groceries" --due "2026-03-01" --flag

# Clear dates
osascript -l JavaScript scripts/update_task.js --id "abc123" --due clear --defer clear

# Move to project and update estimate
osascript -l JavaScript scripts/update_task.js "Research" --project "Work" --estimate 60

# Add and remove tags
osascript -l JavaScript scripts/update_task.js --id "xyz" --tag "🐸 Frog" --remove-tag "Old Tag"
```

### Complete/Uncomplete Task (`complete_task.js`)

Mark tasks as complete or incomplete.

**Usage:**
```bash
# Complete by name
osascript -l JavaScript scripts/complete_task.js "Task name"

# Complete by ID
osascript -l JavaScript scripts/complete_task.js --id "taskId"

# Mark incomplete
osascript -l JavaScript scripts/complete_task.js --id "taskId" --incomplete
```

**Response:**
```json
{
  "ok": true,
  "id": "taskId",
  "name": "Task name",
  "action": "completed",  // or "uncompleted"
  "task": { /* full task object */ }
}
```

## Subtask Operations

### Create Subtask (`add_subtask.js`)

Create child tasks under any existing task. Supports arbitrary nesting depth (Package → Task → Step → Sub-Step).

**Usage:**
```bash
# By parent name
osascript -l JavaScript scripts/add_subtask.js "Subtask name" --parent "Parent name"

# By parent ID (most reliable)
osascript -l JavaScript scripts/add_subtask.js "Subtask name" --parent-id "parentId"
```

**Parent Identification (one required):**

| Flag | Description |
|------|-------------|
| `--parent "name"` | Find parent by exact name, ID, or substring (may be ambiguous) |
| `--parent-id "ID"` | Find parent by OmniFocus task ID (most reliable) |

**Options:** Same as `add_task.js` (except `--project`), including `--due --defer --planned --tag --flag --estimate --sequential --repeat`

**Response:**
```json
{
  "ok": true,
  "id": "subtaskId",
  "name": "Subtask name",
  "task": { /* full task object */ },
  "parent": {
    "id": "parentId",
    "name": "Parent name",
    "project": "Project name"
  }
}
```

**Examples:**
```bash
# Add Task under Package
osascript -l JavaScript scripts/add_subtask.js "☑️🗂️ Research catering" \
  --parent "📦 Wedding planning" --estimate 45

# Add Step under Task (by parent ID)
osascript -l JavaScript scripts/add_subtask.js "☑️🪫 Call vendor for quote" \
  --parent-id "abc123XYZ" --tag "☎️ Telefon" --estimate 10

# Nested subtask (arbitrary depth)
osascript -l JavaScript scripts/add_subtask.js "Sub-step detail" \
  --parent-id "stepId" --due "2026-03-01"
```

## Bulk Operations

All bulk operations accept JSON from stdin and continue processing on individual failures.

### Bulk Create (`bulk_create_tasks.js`)

Create multiple tasks at once from JSON array.

**Usage:**
```bash
echo '[{...}, {...}]' | osascript -l JavaScript scripts/bulk_create_tasks.js
osascript -l JavaScript scripts/bulk_create_tasks.js < tasks.json
```

**Input Format:**
```json
[
  {"name": "Task 1", "due": "2026-03-01", "flag": true},
  {"name": "Task 2", "note": "Context", "estimate": 30},
  {"name": "Task 3", "project": "Work", "tags": ["🔴 P1"]}
]
```

**Each object supports:** `name` (required), `note`, `due`, `defer`, `planned`, `flag`, `estimate`, `project`, `sequential`, `repeat`, `repeatMethod`, `tags` (array)

**Response:**
```json
[
  {"ok": true, "id": "id1", "name": "Task 1", "task": {...}},
  {"ok": true, "id": "id2", "name": "Task 2", "task": {...}},
  {"ok": false, "error": "Error message", "name": "Task 3"}
]
```

**Behavior:** Continues on individual failures, returns all results

### Bulk Update (`bulk_update_tasks.js`)

Update multiple tasks at once from JSON array.

**Usage:**
```bash
echo '[{...}, {...}]' | osascript -l JavaScript scripts/bulk_update_tasks.js
osascript -l JavaScript scripts/bulk_update_tasks.js < updates.json
```

**Input Format:**
```json
[
  {"id": "taskId1", "note": "Updated", "flag": true},
  {"id": "taskId2", "due": "2026-03-15", "estimate": 60},
  {"id": "taskId3", "complete": true}
]
```

**Each object requires:** `id` (required)
**Each object supports:** All `update_task.js` options (`name`, `note`, `noteAppend`, `due`, `defer`, `planned`, `flag`, `unflag`, `estimate`, `tags`, `removeTags`, `project`, `sequential`, `parallel`, `repeat`, `repeatMethod`, `complete`, `incomplete`)

**Response:**
```json
[
  {"ok": true, "id": "id1", "changes": ["note updated", "flagged"], "task": {...}},
  {"ok": true, "id": "id2", "changes": ["due: 2026-03-15", "estimate: 60min"], "task": {...}},
  {"ok": false, "id": "id3", "error": "Task not found"}
]
```

### Bulk Complete (`bulk_complete_tasks.js`)

Complete or uncomplete multiple tasks at once from ID array.

**Usage:**
```bash
# Complete multiple tasks
echo '["taskId1", "taskId2", "taskId3"]' | osascript -l JavaScript scripts/bulk_complete_tasks.js

# Mark multiple incomplete
echo '["taskId1", "taskId2"]' | osascript -l JavaScript scripts/bulk_complete_tasks.js --incomplete

# From file
osascript -l JavaScript scripts/bulk_complete_tasks.js < task_ids.json
```

**Input Format:**
```json
["abc123", "xyz789", "def456"]
```

**Options:**
| Flag | Description |
|------|-------------|
| `--incomplete` | Mark tasks as incomplete instead of complete |

**Response:**
```json
[
  {"ok": true, "id": "abc123", "action": "completed", "task": {...}},
  {"ok": true, "id": "xyz789", "action": "completed", "task": {...}},
  {"ok": false, "id": "def456", "error": "Task not found"}
]
```

## Task Lookup Strategy

All scripts use three-stage lookup (defined in `_omnifocus_lib.js`):

1. **ID lookup** (fast path) — If query looks like ID, try direct lookup
2. **Exact name match** — Search for exact task name
3. **Substring match** — Case-insensitive contains search

**Disambiguation:** If multiple matches, returns error with candidates:
```json
{
  "ok": false,
  "error": "Ambiguous: 3 tasks match \"meeting\". Use --id to specify.",
  "candidates": [
    {"id": "abc123", "name": "Meeting with Julia", "project": "Work"},
    {"id": "xyz789", "name": "Team meeting", "project": "Work"},
    {"id": "def456", "name": "Meeting notes", "project": "Inbox"}
  ]
}
```

**Resolution:** Use `--id` with one of the candidate IDs for precise targeting.

## Date Formats

All date parameters accept:
- `YYYY-MM-DD` — Date only (local timezone)
- `YYYY-MM-DDTHH:MM` — Date and time (local timezone)
- `clear` — Clear existing date (update operations only)

**Examples:**
```bash
--due "2026-03-01"           # March 1st
--due "2026-03-01T14:30"     # March 1st at 2:30 PM
--due clear                  # Remove due date
```

## Repetition Rules

OmniFocus uses RRULE format for repetition. Common patterns:

| Pattern | RRULE |
|---------|-------|
| Every day | `FREQ=DAILY;INTERVAL=1` |
| Every 2 days | `FREQ=DAILY;INTERVAL=2` |
| Every week | `FREQ=WEEKLY;INTERVAL=1` |
| Every Mon, Wed, Fri | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| Every Sunday | `FREQ=WEEKLY;BYDAY=SU` |
| Every month | `FREQ=MONTHLY;INTERVAL=1` |
| First of month | `FREQ=MONTHLY;BYMONTHDAY=1` |
| Every year | `FREQ=YEARLY;INTERVAL=1` |

**Repeat Methods:**
- `due-date` — Fixed schedule (repeat from original due date)
- `completion` — Repeat after task is completed

## Task Output Format

All operations return tasks with standardized full format:

```json
{
  "name": "☑️🔴‼️🐸 Task name",
  "id": "abc123XYZ",
  "note": "Task note",
  "dueDate": "2026-03-01T00:00:00.000Z",
  "deferDate": null,
  "plannedDate": "2026-02-28T23:00:00.000Z",
  "effectiveDueDate": "2026-03-01T00:00:00.000Z",
  "effectiveDeferDate": null,
  "effectivePlannedDate": "2026-02-28T23:00:00.000Z",
  "flagged": true,
  "effectiveFlagged": true,
  "estimatedMinutes": 30,
  "completed": false,
  "completionDate": null,
  "creationDate": "2026-02-01T10:00:00.000Z",
  "modificationDate": "2026-02-05T14:30:00.000Z",
  "sequential": false,
  "inInbox": false,
  "blocked": false,
  "project": "Work",
  "parentTask": {"id": "xyz789", "name": "Parent task"},
  "tags": ["🐸 Frog", "☎️ Telefon"],
  "repetitionRule": {"rule": "FREQ=WEEKLY;INTERVAL=1", "method": "due date"},
  "childCount": 3
}
```

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Task not found" | Query doesn't match any task | Try `search_tasks.js` first, or use exact ID |
| "Ambiguous: N tasks match" | Multiple tasks have similar names | Use `--id` with candidate ID from error |
| "Invalid date" | Date format incorrect | Use `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` |
| "Project not found" | Project name doesn't match | Check spelling, try `list_projects.js` |
| "Tag not found" | Tag doesn't exist | Use `list_tags.js` to find tags, or `create_tag.js` to create |
| "OmniFocus not running" | Application not open | Start OmniFocus application |
| "Failed to create task" | Invalid metadata (date, project, etc.) | Check error message for specific field |

## Common Workflows

**Daily Task Management:**
```bash
# List today's tasks
osascript -l JavaScript scripts/list_tasks.js inbox
osascript -l JavaScript scripts/list_tasks.js flagged

# Quick capture
osascript -l JavaScript scripts/add_task.js "New task" --flag

# Complete task
osascript -l JavaScript scripts/complete_task.js "Task name"
```

**Task Processing:**
```bash
# Search for task
osascript -l JavaScript scripts/search_tasks.js "keyword"

# Update with metadata
osascript -l JavaScript scripts/update_task.js --id "abc123" \
  --due "2026-03-01" \
  --tag "🔴 P1" \
  --estimate 30

# Create subtasks
osascript -l JavaScript scripts/add_subtask.js "Step 1" --parent-id "abc123"
osascript -l JavaScript scripts/add_subtask.js "Step 2" --parent-id "abc123"
```

**Bulk Operations:**
```bash
# Batch create from file
cat tasks.json | osascript -l JavaScript scripts/bulk_create_tasks.js

# Batch update
echo '[{"id":"id1","due":"2026-03-01"},{"id":"id2","flag":true}]' | \
  osascript -l JavaScript scripts/bulk_update_tasks.js

# Batch complete
echo '["id1","id2","id3"]' | osascript -l JavaScript scripts/bulk_complete_tasks.js
```

## Related Skills

- **omnifocus** — Base skill (all scripts live in `omnifocus/scripts/`)
- **omnifocus-tags** — Tag discovery, search, and safe application (strict: never creates)
- **omnifocus-projects** — Project management and folder operations
- **omnifocus-inbox** — Enhanced inbox capture workflow
- **omnifocus-process** — Inbox zero processing automation
- **omnifocus-forecast** — Daily forecast with spoon budgeting

## Requirements

- macOS
- OmniFocus installed and running
- Scripts have execute permissions

## Technical Notes

- All scripts use JXA (JavaScript for Automation), not AppleScript
- Shared library: `/Users/max/.skills/openclaw/omnifocus/scripts/_omnifocus_lib.js`
- Task lookup: ID → exact name → substring → disambiguate (strict three-stage strategy)
- Tag/Project lookup: Exact → substring → disambiguate (never auto-creates)
- Date parsing: Local timezone interpretation (not UTC)
- Error format: `{ ok: false, error: "message", ...extra }`
- Success format: `{ ok: true, ...data }`
- All bulk operations continue processing on individual failures
