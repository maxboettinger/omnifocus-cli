---
name: omnifocus-tasks
description: "Task and inbox operations for omnifocus-cli. Use for create/read/update/complete/search/show/subtask/tag actions, inbox processing, and bulk stdin JSON workflows."
---

# OmniFocus Tasks (CLI)

Use this skill for all task-level work.

## Task Commands

- Add: `of task add <name> [--note --due --defer --planned --tag --flag --estimate --project --sequential --repeat --repeat-method]`
- List: `of task list [--filter inbox|available|flagged|due-soon|overdue|all] [--limit N]`
- Show: `of task show [query] [--id <id>]`
- Search: `of task search <query> [--limit N]`
- Update: `of task update [query] [--id <id>] [mutation flags]`
- Complete/uncomplete: `of task complete [query] [--id <id>] [--incomplete]`
- Add subtask: `of task subtask <name> --parent <query> | --parent-id <id> [metadata flags]`
- Apply tags: `of task tag <query> <tags...> [--id <id>]`

## Inbox Commands

- List inbox: `of inbox list [--limit N]`
- Quick capture: `of inbox add <name> [--note --due --defer --planned --tag --flag --estimate --project --repeat --repeat-method]`
- Process existing inbox item: `of inbox process <id> [--name --note --note-append --project --tag --remove-tag --due --defer --planned --estimate --flag --unflag --sequential --parallel --repeat --repeat-method --complete --delete --dry-run]`

## Bulk Commands (stdin JSON)

- Create tasks: `cat tasks.json | of bulk create --json`
- Update tasks: `cat updates.json | of bulk update --json`
- Complete tasks: `cat ids.json | of bulk complete --json`
- Mark incomplete: `cat ids.json | of bulk complete --incomplete --json`

Required JSON payloads:

- `bulk create`: array of objects with at least `name`
- `bulk update`: array of objects with at least `id`
- `bulk complete`: array of task ID strings

## Agent Workflow Pattern

1. Discover (`task search`, `task list`, `task show`) when identity is uncertain.
2. Use `--id` once a stable target is known.
3. Mutate with the smallest necessary command.
4. Verify with `--json` read-back for multi-step flows.

## Safety

- Do not assume projects or tags exist. If assignment fails, discover via `of project list` or `of tag list` first.
- For inbox processing, use `--dry-run` when applying many field changes at once.
