---
name: omnifocus
description: "Base OmniFocus automation skill — provides JXA scripts for task management, projects, tags, inbox processing, and statistics. For comprehensive task operations (CRUD, search, bulk), see omnifocus-tasks skill. For tag management, see omnifocus-tags skill. For project operations, see omnifocus-projects skill."
---

# OmniFocus Automation

Base OmniFocus automation via JavaScript for Automation (JXA) scripts. All scripts live in `scripts/` directory.

**📖 For detailed task operations, see [omnifocus-tasks](../omnifocus-tasks/SKILL.md)** — Comprehensive CRUD, search, filtering, bulk operations, and subtask management.

## Taxonomy (MANDATORY)
Before creating or updating ANY task, apply Max's lifeOS taxonomy. See [Taxonomy Reference](references/taxonomy-reference.md) for the complete specification including:
- Emoji decoration chain, tag tables, spoon costs, time estimation buffers
- OmniFocus metadata fields and available scripts reference

## Quick Start

All scripts are located in the `scripts/` directory and use JXA. Run with:

```bash
osascript -l JavaScript scripts/<script-name>.js [args]
```

**Key Scripts:**
- `forecast.js` - **Daily forecast** with categorized buckets, spoon budget, drag detection
- `process_inbox_item.js` - **Process inbox items** (rename, move, tag, date, estimate, flag, repeat, delete)
- `add_task.js` - **Full-featured task creation** (inbox or project, all metadata)
- `add_inbox.js` - **Enhanced inbox add** with tags, defer, flag, estimate, repeat
- `add_subtask.js` - **Add nested sub-tasks** under any existing task (supports full hierarchy)
- `update_task.js` - **Update any task property** (all metadata fields supported)
- `complete_task.js` - **Complete/uncomplete tasks** with disambiguation
- `list_tasks.js` - **List tasks** with filters (inbox, available, flagged, etc.)
- `search_tasks.js` - **Search tasks** by keyword
- `get_stats.js` - **Get OmniFocus statistics** including project counts and estimates

## Core Operations

### Adding Tasks (Full-Featured)

Create tasks with all metadata options. Can create in inbox or directly in a project.

```bash
osascript -l JavaScript scripts/add_task.js "Task name" [options]
```

**Options:**
| Flag | Value | Description |
|------|-------|-------------|
| `--note` | "text" | Task note / context |
| `--due` | YYYY-MM-DD | Due date (or YYYY-MM-DDTHH:MM) |
| `--defer` | YYYY-MM-DD | Defer/start date |
| `--planned` | YYYY-MM-DD | Planned date (OmniFocus 4.7+ "Plan for Today") |
| `--tag` | "Tag Name" | Add existing tag (repeatable, strict: never creates — see `omnifocus-tags`) |
| `--flag` | | Flag the task |
| `--estimate` | N | Estimated minutes |
| `--project` | "Project Name" | Create in project (not inbox) |
| `--sequential` | | Set children to sequential |
| `--repeat` | "RRULE" | Repetition rule (e.g., "FREQ=DAILY;INTERVAL=1") |
| `--repeat-method` | "due-date\|completion" | Repeat method |

**Returns:** JSON `{ ok, id, name, task: { full task object } }`

**Examples:**
```bash
# Simple inbox task
osascript -l JavaScript scripts/add_task.js "Buy groceries"

# Full taxonomy with all metadata
osascript -l JavaScript scripts/add_task.js "☑️🔴‼️🐸 Call tax attorney" \
  --tag "🐸 Frog" --due "2026-02-05" --flag --estimate 15

# Create directly in project with repetition
osascript -l JavaScript scripts/add_task.js "Weekly review" \
  --project "Routines" --repeat "FREQ=WEEKLY;BYDAY=SU" --repeat-method due-date

# Plan task for a specific day
osascript -l JavaScript scripts/add_task.js "Sprint planning" \
  --planned "2026-02-10" --estimate 30
```

### Adding Tasks to Inbox (Enhanced)

Same as `add_task.js` but always creates in inbox (with optional move to project).

```bash
osascript -l JavaScript scripts/add_inbox.js "Task name" [options]
```

All options from `add_task.js` are supported (including `--planned`), plus `--project` will move the task after creation.

### Adding Sub-Tasks (Nested Hierarchy)

Create child tasks under any existing task — supports arbitrary nesting depth.

```bash
osascript -l JavaScript scripts/add_subtask.js "Subtask name" --parent "Parent name or ID" [options]
```

**Parent identification (one required):**
| Flag | Description |
|------|-------------|
| `--parent "name or ID"` | Find parent by exact name, ID, or substring |
| `--parent-id "ID"` | Find parent by OmniFocus task ID (most reliable) |

**Options:** Same as `add_task.js` (except `--project`), including `--planned`

**Returns:** JSON `{ ok, id, name, task: {...}, parent: { id, name, project } }`

**Examples:**
```bash
# Add a Task under a Package
osascript -l JavaScript scripts/add_subtask.js "☑️🗂️ Research catering" \
  --parent "📦 Wedding planning" --estimate 45

# Add a Step under a Task (by parent ID)
osascript -l JavaScript scripts/add_subtask.js "☑️🪫 Call Müller's for quote" \
  --parent-id "abc123XYZ" --tag "☎️ Telefon" --estimate 10

# With repetition
osascript -l JavaScript scripts/add_subtask.js "Daily check" \
  --parent "Routines" --repeat "FREQ=DAILY;INTERVAL=1"
```

### Updating Tasks

Update any task property with full metadata support.

```bash
osascript -l JavaScript scripts/update_task.js "Task name" [options]
osascript -l JavaScript scripts/update_task.js --id "taskId" [options]
```

**Task lookup:** First positional arg or `--id`. Finds by: ID → exact name → substring → disambiguate

**Options:**
| Flag | Value | Description |
|------|-------|-------------|
| `--id` | "taskId" | Find by task ID (most reliable) |
| `--name` | "new name" | Rename the task |
| `--note` | "text" | Set/replace note |
| `--note-append` | "text" | Append to existing note |
| `--due` | YYYY-MM-DD \| clear | Set or clear due date |
| `--defer` | YYYY-MM-DD \| clear | Set or clear defer date |
| `--planned` | YYYY-MM-DD \| clear | Set or clear planned date (OmniFocus 4.7+) |
| `--flag` | | Flag the task |
| `--unflag` | | Unflag the task |
| `--estimate` | N \| clear | Set or clear estimate (minutes) |
| `--tag` | "name" | Add existing tag (repeatable, strict: never creates) |
| `--remove-tag` | "name" | Remove tag (repeatable) |
| `--project` | "name" | Move to project |
| `--sequential` | | Set children to sequential |
| `--parallel` | | Set children to parallel |
| `--repeat` | "RRULE" \| clear | Set or clear repetition |
| `--repeat-method` | "due-date\|completion" | Repeat method |
| `--complete` | | Mark task complete |
| `--incomplete` | | Mark task incomplete |

**Returns:** JSON `{ ok, id, changes, task: { full task object } }`

**Examples:**
```bash
# Update due date and flag
osascript -l JavaScript scripts/update_task.js "Buy groceries" --due "2026-03-01" --flag

# Clear dates and add tags
osascript -l JavaScript scripts/update_task.js --id "abc123" --due clear --tag "🐸 Frog"

# Set or clear planned date
osascript -l JavaScript scripts/update_task.js --id "abc123" --planned "2026-02-10"
osascript -l JavaScript scripts/update_task.js --id "abc123" --planned clear

# Set repetition
osascript -l JavaScript scripts/update_task.js "Review metrics" \
  --repeat "FREQ=WEEKLY;INTERVAL=1" --repeat-method due-date

# Move to project and update estimate
osascript -l JavaScript scripts/update_task.js "Research" --project "Work" --estimate 60
```

### Completing Tasks

Complete or uncomplete tasks with smart lookup.

```bash
osascript -l JavaScript scripts/complete_task.js "Task name"
osascript -l JavaScript scripts/complete_task.js --id "taskId"
osascript -l JavaScript scripts/complete_task.js "Task name" --incomplete
```

**Options:**
| Flag | Description |
|------|-------------|
| `--id "taskId"` | Find by task ID (most reliable) |
| `--incomplete` | Mark task as incomplete instead of complete |

**Returns:** JSON `{ ok, id, name, action: "completed"|"uncompleted", task: {...} }`

### Listing Tasks

List tasks with various filters.

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

**Returns:** JSON array of tasks with full metadata

### Searching Tasks

```bash
osascript -l JavaScript scripts/search_tasks.js "keyword" [limit]
```

Searches task names and notes (case-insensitive). Returns incomplete tasks only.

### Processing Inbox Items

Full-featured inbox item processing for the inbox zero workflow.

```bash
osascript -l JavaScript scripts/process_inbox_item.js <ID> [options]
```

**Options:** Same as `update_task.js` (including `--planned`), plus:
| Flag | Description |
|------|-------------|
| `--delete` | Remove task from OmniFocus |
| `--dry-run` | Preview changes without applying |

**Returns:** JSON `{ ok, id, changes, task: {...} }`

### Getting Statistics

```bash
osascript -l JavaScript scripts/get_stats.js
```

**Returns:** JSON with comprehensive counts:
```json
{
  "total": 1234,
  "incomplete": 567,
  "inbox": 12,
  "flagged": 5,
  "overdue": 3,
  "dueSoon": 8,
  "available": 234,
  "blocked": 333,
  "totalEstimatedMinutes": 4560,
  "totalEstimatedHours": 76,
  "tasksWithEstimates": 89,
  "repeatingTasks": 15,
  "sequentialGroups": 7,
  "projects": {
    "total": 45,
    "active": 32,
    "onHold": 5,
    "completed": 6,
    "dropped": 2
  }
}
```

### Daily Forecast

Get categorized task view with spoon budget tracking.

```bash
osascript -l JavaScript scripts/forecast.js [upcoming_days] [--include-flagged] [--include-available]
```

**Options:**
- `upcoming_days` - Number of days to look ahead (default: 3)
- `--include-flagged` - Include flagged tasks bucket
- `--include-available` - Include available tasks bucket

**Returns:** JSON with buckets:
- `overdue` - Past due
- `due_today` - Due today
- `planned_today` - **Planned for today** (OmniFocus 4.7+ "Plan for Today" feature)
- `deferred_today` - Became available today (defer date)
- `flagged` - Flagged tasks (if `--include-flagged`)
- `upcoming` - Due within N days
- `available_next` - Available tasks (if `--include-available`)

Each task includes: name, id, project, tags, dates (including `plannedDate`), flagged, estimatedMinutes, spoonCost, spoonEmoji, priority, rigidity, repetitionRule, sequential, creationDate, etc.

**⚠️ Defer vs Planned (OmniFocus 4.7+):**
- **`deferDate`** = When task BECOMES AVAILABLE (hidden until this date)
- **`plannedDate`** = When you PLAN to work on the task (remains available, just scheduled)

For the morning briefing, **`planned_today`** is the primary bucket — these are tasks Max has explicitly scheduled for today.

### Weekly Review

```bash
osascript -l JavaScript scripts/weekly_review.js [weeks_ago]
```

- `0` = current week (Mon-Sun), `1` = last week. Default: `0`.
- Takes ~20-30s (batch reads all tasks).

**Returns:** JSON with completed tasks, summary by purpose/spoon/project, and project progress.

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

**Repeat methods:**
- `due-date` — Fixed schedule (repeat from original due date)
- `completion` — Repeat after task is completed

## Task Output Format

All scripts return tasks with the standardized full format:

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
  "parentTask": { "id": "xyz789", "name": "Parent task" },
  "tags": ["🐸 Frog", "☎️ Telefon"],
  "repetitionRule": { "rule": "FREQ=WEEKLY;INTERVAL=1", "method": "due date" },
  "childCount": 3
}
```

## Key Date Distinction (OmniFocus 4.7+)

| Date Type | Property | Meaning |
|-----------|----------|---------|
| **Defer** | `deferDate` | When task becomes AVAILABLE (hidden until this date) |
| **Planned** | `plannedDate` | When you PLAN to work on it (remains available, just scheduled) |
| **Due** | `dueDate` | Hard deadline (task should be completed by this date) |

**For the morning briefing:** Use `planned_today` bucket — these are tasks Max has SCHEDULED for today, not just tasks that happened to become available.

## Usage Guidelines

### When Responding to User Queries

1. **List tasks** before acting on them to confirm targets
2. **Parse JSON output** for structured processing
3. **Present results** in user-friendly format (not raw JSON)
4. **Confirm operations** before completing or modifying tasks
5. **Handle errors gracefully** (task not found, ambiguous matches)

### Common Patterns

**Daily Forecast:**
```bash
osascript -l JavaScript scripts/forecast.js 5 --include-flagged --include-available
```

**Inbox Zero Workflow:**
```bash
# List inbox
osascript -l JavaScript scripts/list_tasks.js inbox

# Process each item
osascript -l JavaScript scripts/process_inbox_item.js "taskId" \
  --project "Work" --tag "🔋 Medium" --due "2026-03-01"
```

**Task Queries:**
```bash
# Search for tasks
osascript -l JavaScript scripts/search_tasks.js "meeting"

# List by tag
osascript -l JavaScript scripts/list_by_tag.js "🐸 Frog"
```

**Tag Management:**
```bash
# List all tags (compact: names only)
osascript -l JavaScript scripts/list_tags.js

# Search tags
osascript -l JavaScript scripts/list_tags.js --search "Julia"

# Apply existing tag (strict: never creates)
osascript -l JavaScript scripts/apply_tag.js "Task name" --tag "🏡 Daheim"

# Create / rename / delete tags
osascript -l JavaScript scripts/create_tag.js "New Tag"
osascript -l JavaScript scripts/rename_tag.js "Old Name" --name "New Name"
osascript -l JavaScript scripts/delete_tag.js "Tag Name" --confirm
```

See `omnifocus-tags/SKILL.md` for full tag management documentation.

### Error Handling

Common errors:
- **Task not found** - Try searching first, or use `--id` for precise lookup
- **Ambiguous match** - Multiple tasks match; use `--id` with one of the returned candidate IDs
- **Invalid date** - Use YYYY-MM-DD format with local date parsing
- **OmniFocus not running** - Scripts require OmniFocus to be running

## Specialized Skills

For focused documentation on specific OmniFocus operations, see:

- **[omnifocus-tasks](../omnifocus-tasks/SKILL.md)** — Comprehensive task operations (CRUD, search, filtering, bulk operations, subtasks)
- **[omnifocus-tags](../omnifocus-tags/SKILL.md)** — Tag management with strict lookup (never auto-creates)
- **[omnifocus-projects](../omnifocus-projects/SKILL.md)** — Project and folder management
- **[omnifocus-inbox](../omnifocus-inbox/SKILL.md)** — Enhanced inbox capture
- **[omnifocus-process](../omnifocus-process/SKILL.md)** — Inbox zero processing workflow
- **[omnifocus-forecast](../omnifocus-forecast/SKILL.md)** — Daily forecast with spoon budgeting

## Technical Reference

For detailed API information and advanced usage, see:
- **JXA API Reference:** `references/jxa-api.md` - Object model, properties, and methods
- **Automation Guide:** `references/automation-guide.md` - Detailed workflows

## Requirements

- macOS
- OmniFocus installed and running
- Scripts have execute permissions (chmod +x)

## Notes

- Scripts use JXA (JavaScript for Automation), not AppleScript
- Task lookup: ID → exact name → substring → disambiguate
- Date format: YYYY-MM-DD (local time) or YYYY-MM-DDTHH:MM
- All output is JSON for structured processing
- All writes return `{ ok: true/false, ... }`
