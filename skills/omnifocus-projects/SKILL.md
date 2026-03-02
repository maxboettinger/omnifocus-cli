---
name: omnifocus-projects
description: "Project and folder management for omnifocus-cli. Use to list/show/create/update/rename/delete projects and to list/create folders safely."
---

# OmniFocus Projects And Folders (CLI)

Use this skill for project namespace management and folder organization.

## Project Commands

- Add: `of project add <name> [--folder --status --sequential --note --flag]`
- List: `of project list [--search --status active|done|onhold|dropped --folder --count --full --active-only --limit N]`
- Show: `of project show <query> [--id <id>]`
- Update: `of project update [query] [--id <id>] [--name --note --note-append --status --folder --sequential --parallel --flag --unflag]`
- Rename: `of project rename <query> <new-name> [--id <id>]`
- Delete: `of project delete <query> [--id <id>] [--confirm]`

## Folder Commands

- List: `of folder list [--search --count --limit N]`
- Add: `of folder add <name> [--parent <name>]`

## Safe Workflow

1. Discover first with `project list` or `project show`.
2. Use `--id` for updates when available.
3. For delete operations, run without `--confirm` first to inspect impact, then rerun with `--confirm`.

## Notes

- Status normalization is handled by the CLI bridge; pass only the supported values shown above.
- Project names are not guaranteed unique in large systems. ID-based updates are preferred for reliability.
