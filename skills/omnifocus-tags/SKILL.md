---
name: omnifocus-tags
description: "Safe OmniFocus tag management — discover, search, apply, and manage tags without polluting the tag namespace. Use when the user asks to find, apply, create, rename, or delete OmniFocus tags, or when you need to determine which tags exist before tagging a task. All tag application uses strict lookup (never creates). This skill provides the canonical discovery and CRUD workflow."
---

# OmniFocus Tag Management

Safe tag discovery, search, and application for OmniFocus. Prevents accidental tag creation by enforcing strict existing-tag-only workflows.

<required>
*CRITICAL* Add the following steps to your Todo list using TodoWrite:

1. Discover available tags with `list_tags.js`
2. Find the exact tag name(s) needed (use `--search` for partial matching)
3. Apply tags using `apply_tag.js` (preferred: atomic validation) or `--tag` flag on any script (all use strict lookup)
4. Verify the tag was applied correctly
</required>

## Why This Skill Exists

All OmniFocus scripts use `findExistingTag` (strict: never creates tags). If you use a tag name that doesn't exist, the operation fails with suggestions instead of silently creating a new tag. This prevents namespace pollution from typos and misspellings.

This skill provides the **canonical workflow** for tag operations: discover available tags first, then apply only existing tags. It also provides dedicated scripts for tag CRUD when you need to explicitly create, rename, or delete tags.

## Tag Discovery (Context-Window-Efficient)

### List All Tags (Compact)

Default output is a **JSON array of strings** — minimal tokens for the context window.

```bash
osascript -l JavaScript scripts/list_tags.js
# → ["🏡 Daheim", "💼 Büro", "🧠 Concentrating", ...]
```

### Search Tags by Name

```bash
osascript -l JavaScript scripts/list_tags.js --search "Julia"
# → ["🦊 Julia"]

osascript -l JavaScript scripts/list_tags.js --search "wait"
# → ["⏸️ waiting:jan", "⏸️ waiting:julia", "⏸️ waiting:other"]
```

### With Task Counts

```bash
osascript -l JavaScript scripts/list_tags.js --count
# → [{"name": "🔴 P1", "taskCount": 66}, {"name": "🟠 P2", "taskCount": 69}, ...]
```

### Active Tags Only (Tags With Incomplete Tasks)

```bash
osascript -l JavaScript scripts/list_tags.js --active-only --count
```

### Limit Results

```bash
osascript -l JavaScript scripts/list_tags.js --limit 10
```

All flags can be combined: `--search "Coding" --count --active-only --limit 5`

## Safe Tag Application

**Prefer `apply_tag.js`** for dedicated tag operations. It provides atomic validation (all tags checked before any are applied). The `--tag` flag on other scripts (`add_task.js`, `update_task.js`, etc.) also uses strict lookup but is non-atomic (applies individually, reports failures).

```bash
osascript -l JavaScript scripts/apply_tag.js "Task name" --tag "🏡 Daheim"
osascript -l JavaScript scripts/apply_tag.js --id "taskId" --tag "🧠 Concentrating" --tag "👨‍💻 Coding"
```

**Behavior:**
- Finds the task by ID → exact name → substring (same lookup as `update_task.js`)
- Validates ALL tags exist BEFORE applying any (atomic: all-or-nothing)
- On unknown tag: returns error with similar tag suggestions
- `--tag` is repeatable for multiple tags
- Returns: `{ ok, id, name, applied: [...], task: { full object } }`

**Error example (tag not found):**
```json
{
  "ok": false,
  "error": "Ambiguous: 2 tags match \"waiting\"",
  "requestedTag": "waiting",
  "candidates": ["⏸️ waiting:jan", "⏸️ waiting:julia"]
}
```

## Tag CRUD

### Create Tag

```bash
osascript -l JavaScript scripts/create_tag.js "New Tag Name"
```

Fails if the tag already exists (prevents duplicates).

### Rename Tag

```bash
osascript -l JavaScript scripts/rename_tag.js "Old Name" --name "New Name"
```

Fails if old tag doesn't exist or new name is already taken.

### Delete Tag

```bash
osascript -l JavaScript scripts/delete_tag.js "Tag Name" --confirm
```

**Requires `--confirm` flag** for safety. Without it, returns a dry-run showing how many tasks are affected. This prevents accidental deletion of tags with active tasks.

**Dry-run (no --confirm):**
```json
{
  "ok": false,
  "error": "Delete requires --confirm flag. Tag \"🐸 Frog\" has 12 incomplete task(s).",
  "tasksAffected": 12,
  "tag": "🐸 Frog"
}
```

## Removing Tags From Tasks

To remove a tag from a task, use the existing `update_task.js`:

```bash
osascript -l JavaScript scripts/update_task.js "Task name" --remove-tag "Tag Name"
```

This is safe — `--remove-tag` only removes; it never creates.

## Workflow: Tagging a Task

1. **Search** for the right tag:
   ```bash
   osascript -l JavaScript scripts/list_tags.js --search "partial"
   ```
2. **Copy the exact name** from the search results
3. **Apply** using the strict script:
   ```bash
   osascript -l JavaScript scripts/apply_tag.js "Task name" --tag "Exact Tag Name"
   ```

## Taxonomy Reference

All canonical tags are documented in [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md). Categories:
- **Context** (WHERE/HOW): 🏡 Daheim, 💼 Büro, 🌲 Draußen, etc.
- **Mode** (WHAT KIND): 🧠 Concentrating, 👨‍💻 Coding, ☎️ Telefon, etc.
- **People**: 🦊 Julia, 🐼 Jan, 🎩 Basti, etc.
- **Special**: 🤖 Routines, ⏸️ blocked, 🏆 Quick Win, etc.
- **Priority**: 🔴 P1, 🟠 P2
- **Spoon**: 🐸 Frog (only frogs get a tag)

**Note:** Category-aware search (e.g., `--category context` to list only context tags) is planned but not yet implemented — the taxonomy categories are defined in the reference doc, not encoded in OmniFocus tag structure.

## Script Quick Reference

| Script | Purpose | Key Flags |
|--------|---------|-----------|
| `list_tags.js` | List/search tags | `--search --count --active-only --limit` |
| `apply_tag.js` | Apply existing tag(s) to task | `--id --tag` (repeatable) |
| `create_tag.js` | Create new tag | (positional name) |
| `delete_tag.js` | Delete tag (safety check) | `--confirm` |
| `rename_tag.js` | Rename tag | `--name "New Name"` |

## Related Skills

- `omnifocus` — Base CRUD layer (all scripts live in `omnifocus/scripts/`)
- `omnifocus-inbox` — Smart capture (applies tags during inbox creation)
- `omnifocus-process` — Inbox triage (routes and re-tags)
- `omnifocus-inbox` — Task creation with taxonomy classification (determines which tags to apply)
