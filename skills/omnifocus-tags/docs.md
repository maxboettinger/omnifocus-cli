# Noridoc: omnifocus-tags

Path: @/omnifocus-tags

### Overview

This is a behavioral/protocol skill (no scripts of its own) that defines how an LLM agent should safely discover, search, apply, and manage OmniFocus tags without polluting the tag namespace. All tag application across the entire codebase uses `findExistingTag` (strict: never creates). This skill provides the canonical workflow for tag operations: discover first, then apply existing only.

### How it fits into the larger codebase

```
                     ┌──────────────────────┐
                     │   omnifocus-tags      │
                     │  (THINKING: safe tag  │
                     │   workflow protocol)  │
                     └──────────┬────────────┘
                                │ routes to
                                ▼
                     ┌──────────────────────┐
                     │ @/omnifocus/scripts/  │
                     │  list_tags.js         │
                     │  apply_tag.js         │
                     │  create_tag.js        │
                     │  rename_tag.js        │
                     │  delete_tag.js        │
                     └──────────┬────────────┘
                                │
                                ▼
                         OmniFocus.app
```

- **Sibling skills**: `omnifocus-inbox`, `omnifocus-create`, and `omnifocus-process` all apply tags during task capture/triage. All tag application (including `--tag` on `add_task.js`, `add_inbox.js`, `update_task.js`, `process_inbox_item.js`) uses `findExistingTag` (strict: never creates). The dedicated `apply_tag.js` additionally provides atomic all-or-nothing validation.
- **Downstream execution**: All scripts live in `@/omnifocus/scripts/`. This skill directory contains only `SKILL.md` (the behavioral protocol) and `test_tags.sh` (integration tests).
- **Shared library**: The tag scripts depend on `findExistingTag()` and `findTag()` from `@/omnifocus/scripts/_omnifocus_lib.js`. The `apply_tag.js` script also uses `findTaskByQuery()` for task lookup and `formatTaskFull()` for output.
- **Shared reference**: The canonical tag taxonomy lives in `@/omnifocus/references/taxonomy-reference.md`, which lists the available scripts table including the tag management scripts.

### Core Implementation

The skill is defined entirely in `SKILL.md` as a protocol for LLM agents. The workflow has two phases:

| Phase | What happens |
|-------|-------------|
| 1. Discover | Agent runs `list_tags.js` (optionally with `--search`) to find exact tag names. Default output is a flat JSON array of tag name strings -- deliberately compact to minimize context window token usage. |
| 2. Apply | Agent uses `apply_tag.js` with the exact tag name(s) from discovery. This script validates ALL tags exist before applying any (atomic all-or-nothing via `findExistingTag`). On failure, it returns candidate suggestions for disambiguation. |

Tag CRUD operations (`create_tag.js`, `rename_tag.js`, `delete_tag.js`) are secondary -- used when the user explicitly asks to manage the tag namespace itself. Each enforces safety invariants: create fails on duplicates, rename fails on conflicts, delete requires `--confirm` and shows a dry-run with affected task counts otherwise.

### Things to Know

- **`apply_tag.js` vs `update_task.js --tag`**: Both apply tags to tasks using `findExistingTag` (strict: never creates). The difference is that `apply_tag.js` is atomic (validates ALL tags before applying any, aborts on failure), while `update_task.js --tag` is best-effort (applies each tag individually, reports failures inline). Prefer `apply_tag.js` for dedicated tag operations.
- **`findExistingTag` resolution order**: Exact name match first, then case-insensitive substring. If substring yields exactly one match, it auto-resolves. If multiple matches, it returns an `Ambiguous` error with up to 10 candidate names. If zero matches, it returns `Tag not found`.
- **`delete_tag.js` two-phase safety**: Without `--confirm`, the script does not delete -- it returns the tag name and count of incomplete tasks that would be affected, acting as a dry-run preview. The `--confirm` flag must be explicitly passed to proceed.
- **Integration tests** in `test_tags.sh` create and clean up a sentinel tag (`__TEST_TAG_DO_NOT_USE__`) and exercise the full lifecycle: list, create, rename, apply (strict failure), delete (with and without confirm). They require OmniFocus running and `jq` installed.
- **Tag removal** is not handled by this skill -- it uses the existing `update_task.js --remove-tag`, which is safe because removal never creates tags.

Created and maintained by Nori.
