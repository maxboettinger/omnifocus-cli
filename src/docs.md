# Noridoc: OmniFocus Scripts

Path: @/omnifocus/scripts

### Overview
JXA (JavaScript for Automation) scripts for comprehensive OmniFocus task management: CRUD operations, forecasting, search, time estimation, statistics, and inbox processing with emoji-based taxonomy support.

### How it fits into the larger codebase

These scripts are the automation layer between Alfred workflows, shell scripts, and OmniFocus. They enable @/morning-briefing to fetch today's tasks, @/omnifocus-* skills to manage inbox/planning workflows, and external tools to create/update tasks programmatically. All scripts share common functionality via @/omnifocus/scripts/_omnifocus_lib.js.

### Core Implementation

**_omnifocus_lib.js** provides shared utilities:
- **Date parsing**: `parseDate()` handles YYYY-MM-DD and YYYY-MM-DDTHH:MM formats in local timezone
- **Tag lookup**: `findExistingTag()` (strict: never creates, returns candidates on ambiguity), `findTag()` (exact match)
- **Project lookup**: `findExistingProject()` (strict: never creates, returns candidates on ambiguity), `findProject()` (creates if not found - legacy)
- **Project output**: `formatProjectFull()` (comprehensive metadata), `formatProjectCompact()` (token-efficient), `normalizeProjectStatus()` (status validation)
- **Task search**: `findTaskByQuery()` tries ID → exact name → substring, returns disambiguation on ambiguity
- **Taxonomy parsing**: `parseSpoonCost()`, `parsePriority()`, `parseRigidity()` extract emoji-based metadata
- **Argument parsing**: `parseArgs(args, schema)` converts CLI flags to options object (camelCase → --kebab-case)
- **Task properties**: `applyTaskProps()` handles due, defer, planned, flag, estimate, sequential, repeat, tags
- **Output formatting**: `formatTaskFull()` generates complete JSON with all standard fields + plannedDate (4.7+)

**Task CRUD operations**:
- **add_task.js**: Create tasks with full metadata (note, due, defer, planned, tags, flag, estimate, project, sequential, repeat); uses `findExistingProject()` for strict project lookup
- **add_subtask.js**: Add subtask under parent with --parent-id
- **add_inbox.js**: Simplified inbox task creation; uses `findExistingProject()` if `--project` specified
- **update_task.js**: Modify task properties, returns changes array; uses `findExistingProject()` for strict project lookup
- **complete_task.js**: Mark task complete
- **process_inbox_item.js**: Convert inbox item to project task; uses `findExistingProject()` for safe project routing

**Project CRUD operations**:
- **list_projects.js**: List/search projects with filters (status, active-only, count, limit); default output is compact string array for token efficiency
- **show_project.js**: Show detailed project info with task counts, completion %, overdue count
- **create_project.js**: Create project with folder support, duplicate prevention
- **update_project.js**: Update project properties (name, status, folder, note, dates, sequential, flagged)
- **rename_project.js**: Rename project with conflict detection
- **delete_project.js**: Safe deletion with dry-run preview (requires --confirm)

**Folder operations**:
- **list_folders.js**: List/search folders
- **create_folder.js**: Create folder with parent support

**Queries**:
- **forecast.js** (~355 lines): Categorized task view with batch property access for performance
  - Buckets: overdue, due_today, planned_today (4.7+), deferred_today, flagged, upcoming, available_next
  - Spoon budget calculation (baseline 20, sum of planned tasks)
  - Drag alerts for tasks overdue 3+ days
  - **Performance**: Batch property access (single Apple Event per property) handles 2000+ tasks in seconds
- **list_tasks.js**: List tasks by project/tag/status
- **list_by_tag.js**: Filter tasks by tag
- **search_tasks.js**: Search tasks by name substring

**Time tracking**:
- **get_estimated_time.js**: Get task time estimate
- **set_estimated_time.js**: Update time estimate
- **get_stats.js**: Project/tag statistics

**Planning**:
- **weekly_review.js**: Weekly review task list

### Things to Know

- All scripts load `_omnifocus_lib.js` via `eval()` + NSString bridge for code reuse
- **OmniFocus 4.7+ distinction**: `plannedDate` = when Max plans to work on task (scheduled), `deferDate` = when task becomes available (hidden until then)
- **Emoji taxonomy** (see @/omnifocus/references/taxonomy-reference.md):
  - Spoons: 🐸(10), 💥(7), 🔋(4), 🪫(1.5), 🔌(-5)
  - Priority: 🔴(P1), 🟠(P2), 🟡(P3), 🔵(P4)
  - Rigidity: ‼️(fixed), ⚠️(firm), 📌(target)
- **Batch property access pattern**: `tasks.property()` returns array for all tasks in single Apple Event, dramatically faster than per-task access
- Error handling uses `lib.err(message, extra)` for standardized JSON errors with optional disambiguation candidates
- Repetition rules use normalized methods: "due date" or "due after completion"

Created and maintained by Nori.
