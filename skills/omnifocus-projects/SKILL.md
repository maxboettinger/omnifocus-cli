---
name: omnifocus-projects
description: "Safe OmniFocus project management — discover, create, update, and manage projects and folders without namespace pollution. Use when you need to find, create, update, move, or delete OmniFocus projects or folders. All project operations use strict lookup (never accidentally create). This skill provides the canonical discovery and CRUD workflow for project management."
---

# OmniFocus Project Management

Safe project and folder discovery, search, and full lifecycle management for OmniFocus. Prevents accidental project creation by enforcing strict existing-project-only workflows for task assignment.

<required>
*CRITICAL* Add the following steps to your Todo list using TodoWrite:

1. Discover available projects with `list_projects.js`
2. Find the exact project name(s) needed (use `--search` for partial matching)
3. Use projects in task operations (all scripts use strict lookup via `findExistingProject()`)
4. Verify operations completed successfully
</required>

## Why This Skill Exists

All OmniFocus scripts that reference projects now use `findExistingProject()` (strict: never creates projects). If you use a project name that doesn't exist, the operation fails with suggestions instead of silently creating a new project. This prevents namespace pollution from typos and misspellings.

This skill provides the **canonical workflow** for project operations: discover available projects first, then reference only existing projects. It also provides dedicated scripts for project CRUD when you need to explicitly create, rename, update, or delete projects.

## Project Discovery (Context-Window-Efficient)

### List All Projects (Compact)

Default output is a **JSON array of strings** — minimal tokens for the context window.

```bash
osascript -l JavaScript scripts/list_projects.js
# → ["⚙️ Technik", "👔 Kleidung", "⚽ Sport", ...]
```

### Search Projects by Name

```bash
osascript -l JavaScript scripts/list_projects.js --search "Technik"
# → ["⚙️ Technik", "🔧 Technik & Tools"]

osascript -l JavaScript scripts/list_projects.js --search "hochzeit"
# → ["🧰 Hochzeit"]
```

### With Task Counts

```bash
osascript -l JavaScript scripts/list_projects.js --count
# → [{"name": "⚙️ Technik", "status": "active", "taskCount": 12}, ...]
```

### Filter by Status

```bash
osascript -l JavaScript scripts/list_projects.js --status active
osascript -l JavaScript scripts/list_projects.js --status done
osascript -l JavaScript scripts/list_projects.js --status onhold
osascript -l JavaScript scripts/list_projects.js --status dropped
```

### Active Projects Only (With Incomplete Tasks)

```bash
osascript -l JavaScript scripts/list_projects.js --active-only --count
```

### Limit Results

```bash
osascript -l JavaScript scripts/list_projects.js --limit 10
```

All flags can be combined: `--search "work" --status active --count --limit 5`

## Viewing Project Details

Get comprehensive information about a specific project:

```bash
osascript -l JavaScript scripts/show_project.js "Project Name"
osascript -l JavaScript scripts/show_project.js --id "project-id"
```

**Returns:** Full project object with:
- Basic info: id, name, note, status, dates
- Task counts: total, completed, overdue
- Completion percentage
- Parent folder, tags
- All metadata

## Project CRUD Operations

### Create Project

```bash
osascript -l JavaScript scripts/create_project.js "New Project Name"
osascript -l JavaScript scripts/create_project.js "New Project" --folder "Work"
osascript -l JavaScript scripts/create_project.js "Planning" --sequential --note "Q1 planning project"
```

**Options:**
- `--folder "name"` — Create in specific folder
- `--status "active|onhold|done|dropped"` — Set initial status
- `--sequential` — Set as sequential project (tasks in order)
- `--note "text"` — Add project note
- `--flag` — Flag the project

**Behavior:**
- Checks if project already exists (prevents duplicates)
- Uses `.push()` method for JXA compatibility
- Returns full project object on success
- Fails with error if project name already taken

### Update Project

```bash
osascript -l JavaScript scripts/update_project.js "Project Name" --status onhold
osascript -l JavaScript scripts/update_project.js "Project Name" --folder "Archive"
osascript -l JavaScript scripts/update_project.js --id "proj-id" --flag --sequential
```

**Options:**
- `--name "new name"` — Rename project (checks for conflicts)
- `--note "text"` — Replace note
- `--note-append "text"` — Append to existing note
- `--status "active|done|onhold|dropped"` — Change status
- `--folder "name"` — Move to different folder
- `--sequential` / `--parallel` — Change task ordering
- `--flag` / `--unflag` — Flag status

**Returns:** `{ ok, id, name, changes: [...], project: {...} }`

### Rename Project

Dedicated script for renaming (validates new name):

```bash
osascript -l JavaScript scripts/rename_project.js "Old Name" --name "New Name"
osascript -l JavaScript scripts/rename_project.js --id "id" --name "New Name"
```

**Behavior:**
- Checks old project exists
- Validates new name doesn't conflict
- Returns error with candidates if ambiguous
- Atomic operation

### Delete Project

**REQUIRES `--confirm` flag for safety.**

```bash
# Dry-run (shows what would be deleted)
osascript -l JavaScript scripts/delete_project.js "Project Name"

# Actually delete
osascript -l JavaScript scripts/delete_project.js "Project Name" --confirm
```

**Dry-run output (without --confirm):**
```json
{
  "ok": false,
  "error": "Delete requires --confirm flag. Project \"Old Project\" has 3 incomplete task(s) (8 total).",
  "tasksAffected": 8,
  "incompleteTasks": 3,
  "project": "Old Project"
}
```

**Confirmed deletion:**
```json
{
  "ok": true,
  "deleted": {
    "id": "project-id",
    "name": "Old Project",
    "tasksAffected": 8
  }
}
```

## Folder Management

### List Folders

```bash
osascript -l JavaScript scripts/list_folders.js
osascript -l JavaScript scripts/list_folders.js --search "work"
osascript -l JavaScript scripts/list_folders.js --count
```

**Options:**
- `--search "query"` — Filter by name
- `--status "active|dropped"` — Filter by status
- `--count` — Include project counts
- `--limit N` — Limit results

### Create Folder

```bash
osascript -l JavaScript scripts/create_folder.js "New Folder"
osascript -l JavaScript scripts/create_folder.js "Sub Folder" --parent "Parent Folder"
```

**Behavior:**
- Checks for duplicate names
- Supports nested folders with `--parent`
- Returns folder object with id, name, parentFolder

## Safe Project References in Task Scripts

All task scripts (`add_task.js`, `update_task.js`, `process_inbox_item.js`, etc.) now use strict project lookup via `findExistingProject()`:

```bash
# These will fail if project doesn't exist (with helpful suggestions)
osascript -l JavaScript scripts/add_task.js "New Task" --project "Hochzeit"
osascript -l JavaScript scripts/update_task.js "Task Name" --project "Work"
osascript -l JavaScript scripts/process_inbox_item.js <id> --project "Personal"
```

**Error example (project not found):**
```json
{
  "ok": false,
  "error": "Project not found: \"Wor\"",
  "suggestion": "Did you mean: \"Work\", \"Workout\", \"Workshop\"?"
}
```

**Error example (ambiguous match):**
```json
{
  "ok": false,
  "error": "Ambiguous: 2 projects match \"Tech\"",
  "candidates": ["⚙️ Technik", "🔧 Technik & Tools"]
}
```

## Workflow: Creating and Using a Project

1. **Check if project exists:**
   ```bash
   osascript -l JavaScript scripts/list_projects.js --search "project name"
   ```

2. **Create if needed:**
   ```bash
   osascript -l JavaScript scripts/create_project.js "New Project" --folder "Work"
   ```

3. **Add tasks to project:**
   ```bash
   osascript -l JavaScript scripts/add_task.js "Task 1" --project "New Project"
   osascript -l JavaScript scripts/add_task.js "Task 2" --project "New Project"
   ```

4. **Update project status when done:**
   ```bash
   osascript -l JavaScript scripts/update_project.js "New Project" --status done
   ```

## Project Statuses

OmniFocus projects have four status values:

| Status | Meaning | When to Use |
|--------|---------|-------------|
| **active** | Currently working on it | Default for ongoing projects |
| **onhold** | Temporarily paused | Projects waiting on external factors |
| **done** | Completed successfully | Finished projects (archived but visible) |
| **dropped** | Abandoned/cancelled | Projects you decided not to pursue |

**Note:** Setting a project to "done" does NOT auto-complete its tasks. Task completion states are preserved.

## Token Efficiency

Use compact format for discovery to minimize context window usage:

```bash
# Compact: ~10 tokens per project (just names)
osascript -l JavaScript scripts/list_projects.js --limit 20

# Medium: ~50 tokens per project (name, status, count)
osascript -l JavaScript scripts/list_projects.js --count --limit 20

# Full: ~300 tokens per project (all fields)
osascript -l JavaScript scripts/list_projects.js --full --limit 5
```

**Recommendation:** Always start with compact format, only use `--count` when you need statistics, and `--full` only for detailed inspection of specific projects.

## Script Quick Reference

| Script | Purpose | Key Flags |
|--------|---------|-----------|
| `list_projects.js` | List/search projects | `--search --status --count --full --active-only --limit` |
| `show_project.js` | Show full project details | `--id` |
| `create_project.js` | Create new project | `--folder --status --sequential --note --flag` |
| `update_project.js` | Update project properties | `--name --status --folder --note --sequential --flag` |
| `rename_project.js` | Rename project (validates) | `--name` |
| `delete_project.js` | Delete project (safety check) | `--confirm` |
| `list_folders.js` | List/search folders | `--search --status --count --limit` |
| `create_folder.js` | Create new folder | `--parent` |

## Related Skills

- `omnifocus` — Base CRUD layer (all scripts live in `omnifocus/scripts/`)
- `omnifocus-tags` — Tag management (strict lookup, discovery, CRUD)
- `omnifocus-inbox` — Smart capture (can specify project during inbox creation)
- `omnifocus-process` — Inbox triage (routes tasks to projects)
- `omnifocus-inbox` — Task creation with taxonomy classification (determines which project to use)
- `omnifocus-forecast` — Daily planning (shows tasks grouped by project)

## Common Patterns

### Archive Completed Projects

```bash
# List completed projects
osascript -l JavaScript scripts/list_projects.js --status done --count

# Review and optionally drop old ones
osascript -l JavaScript scripts/update_project.js "Old Project" --status dropped
```

### Reorganize Projects into Folders

```bash
# Create folder
osascript -l JavaScript scripts/create_folder.js "Archive 2025"

# Move multiple projects
osascript -l JavaScript scripts/update_project.js "Project A" --folder "Archive 2025"
osascript -l JavaScript scripts/update_project.js "Project B" --folder "Archive 2025"
```

### Find Stale Projects

```bash
# Show all projects with counts
osascript -l JavaScript scripts/list_projects.js --count | jq '.[] | select(.taskCount == 0)'
```

### Batch Status Update

```bash
# Find candidates
osascript -l JavaScript scripts/list_projects.js --search "2025" --status active

# Update each one
osascript -l JavaScript scripts/update_project.js "Q1 2025 Goals" --status done
```

## Edge Cases and Error Handling

All scripts handle these edge cases gracefully:

- **Unicode characters** in project/folder names (emoji, German characters)
- **Special characters** in names (punctuation, quotes)
- **Duplicate names** — create/rename operations check for conflicts
- **Ambiguous searches** — return helpful candidates list
- **Non-existent projects** — clear error messages with suggestions
- **Empty results** — return empty array `[]` not error
- **Folder hierarchy** — supports nested folders, validates parent exists
- **Concurrent modifications** — validates project still exists before operations

## Performance Notes

- **Project listing** — Fast for <200 projects, may be slow for >500 projects (JXA limitation)
- **Compact format** — Use `--limit` to reduce load time for large project lists
- **Search operations** — Substring matching is case-insensitive but requires full scan
- **Folder operations** — Moving projects between folders is fast (<1 second)

## Troubleshooting

**"Project not found" but I can see it in OmniFocus:**
- Try `--search` with partial name: `list_projects.js --search "part"`
- Check spelling (case-insensitive but must match substring)
- Ensure you're looking in the right folder context

**"Ambiguous match" errors:**
- Use `--id` instead of name for precision
- Get ID from `show_project.js` or `list_projects.js --count`
- Make search query more specific

**Slow performance with many projects:**
- Use `--limit` to reduce results
- Use compact format (default) instead of `--full`
- Consider archiving completed projects to reduce active count

**Can't delete project:**
- Remember to use `--confirm` flag
- Check dry-run output to see task counts
- Complete or delete tasks first if desired
