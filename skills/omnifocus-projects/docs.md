# Noridoc: omnifocus-projects

Path: @/omnifocus-projects

### Overview

This is a behavioral/protocol skill (no scripts of its own) that defines how an LLM agent should safely discover, search, create, update, and manage OmniFocus projects and folders without polluting the project namespace. All project references across the entire codebase now use `findExistingProject` (strict: never creates). This skill provides the canonical workflow for project operations: discover first, then reference existing only, with explicit CRUD for management.

### How it fits into the larger codebase

```
                     ┌──────────────────────┐
                     │ omnifocus-projects    │
                     │ (THINKING: safe       │
                     │  project workflow)    │
                     └──────────┬─────────────┘
                                │ routes to
                                ▼
                     ┌──────────────────────┐
                     │ @/omnifocus/scripts/  │
                     │  list_projects.js     │
                     │  show_project.js      │
                     │  create_project.js    │
                     │  update_project.js    │
                     │  rename_project.js    │
                     │  delete_project.js    │
                     │  list_folders.js      │
                     │  create_folder.js     │
                     └──────────┬─────────────┘
                                │
                                ▼
                         OmniFocus.app
```

- **Sibling skills**: `omnifocus-inbox`, `omnifocus-create`, `omnifocus-process`, and `omnifocus-forecast` all reference projects during task capture, triage, and planning. All project references (including `--project` on `add_task.js`, `add_inbox.js`, `update_task.js`, `process_inbox_item.js`) use `findExistingProject` (strict: never creates). This prevents accidental project creation from typos.
- **Downstream execution**: All scripts live in `@/omnifocus/scripts/`. This skill directory contains only `SKILL.md` (the behavioral protocol).
- **Shared library**: The project scripts depend on `findExistingProject()`, `formatProjectFull()`, `formatProjectCompact()`, and `normalizeProjectStatus()` from `@/omnifocus/scripts/_omnifocus_lib.js`. They also use `parseArgs()` for CLI argument parsing.
- **Shared reference**: The canonical project taxonomy and emoji decoration chain live in `@/omnifocus/references/taxonomy-reference.md`.
- **Mirror pattern**: This skill exactly mirrors `@/omnifocus-tags` in structure, safety patterns, and workflow design.

### Core Implementation

The skill is defined entirely in `SKILL.md` as a protocol for LLM agents. The workflow has three phases:

| Phase | What happens |
|-------|-------------|
| 1. Discover | Agent runs `list_projects.js` (optionally with `--search`, `--status`, `--active-only`) to find exact project names. Default output is a flat JSON array of project name strings -- deliberately compact to minimize context window token usage. Use `--count` for metadata (status, taskCount). |
| 2. Reference | Agent uses project names from discovery in task operations (`add_task.js --project`, `update_task.js --project`, etc.). All scripts validate via `findExistingProject` (strict: never creates). On failure, returns candidate suggestions for disambiguation. |
| 3. Manage | Agent uses dedicated CRUD scripts (`create_project.js`, `update_project.js`, `rename_project.js`, `delete_project.js`) when the user explicitly asks to manage projects. Folders are managed via `list_folders.js` and `create_folder.js`. |

**Progressive disclosure for token efficiency:** Three output formats optimize context window usage:
- **Compact** (default): Plain string array `["Project 1", "Project 2"]` (~10 tokens/project)
- **Count** (`--count`): Objects with `{name, status, taskCount}` (~50 tokens/project)
- **Full** (`show_project.js`): Complete metadata with dates, tags, folder, completion stats (~300 tokens/project)

Project CRUD operations (`create_project.js`, `update_project.js`, `rename_project.js`, `delete_project.js`) are secondary -- used when the user explicitly asks to manage the project namespace itself. Each enforces safety invariants: create fails on duplicates, update validates all properties, rename fails on conflicts, delete requires `--confirm` and shows a dry-run with affected task counts otherwise.

### Things to Know

- **`findExistingProject` resolution order**: Exact name match first, then case-insensitive substring. If substring yields exactly one match, it auto-resolves. If multiple matches, it returns an `Ambiguous` error with up to 10 candidate names. If zero matches, it returns `Project not found: "name"`.
- **`delete_project.js` two-phase safety**: Without `--confirm`, the script does not delete -- it returns the project name, task count, and completed task count as a dry-run preview. The `--confirm` flag must be explicitly passed to proceed with deletion.
- **Folder management**: `list_folders.js` and `create_folder.js` provide folder discovery and creation. Projects can be organized into folders via `create_project.js --folder` or `update_project.js --folder`. Folder lookup uses the same exact→substring cascade as project lookup.
- **Status normalization**: `normalizeProjectStatus()` handles status strings (active/done/onhold/dropped) and converts them to OmniFocus API format (e.g., "active" → "active status"). This abstraction hides the JXA quirk where status strings need " status" suffix.
- **Integration tests** live in `@/omnifocus/tests/` and exercise the full project lifecycle: list, create, show, update, rename, delete. They use `TEST_` prefix guardrails to prevent production data corruption.

Created and maintained by Nori.
