---
name: omnifocus-tags
description: "Tag operations for omnifocus-cli. Use to discover, create, rename, delete tags and inspect tasks by tag, then apply tags to tasks via task/inbox commands."
---

# OmniFocus Tags (CLI)

Use this skill when the request is primarily tag-centric.

## Tag Commands

- Add tag: `of tag add <name>`
- List tags: `of tag list [--search <query>] [--count] [--active-only] [--limit N]`
- Rename tag: `of tag rename <old-name> <new-name>`
- Delete tag: `of tag delete <name> [--confirm]`
- Tasks by tag: `of tag tasks <name> [--limit N]`

## Applying Tags To Tasks

Use task/inbox commands for assignment:

- Apply tags: `of task tag <query> <tags...> [--id <id>]`
- Add tags on update: `of task update ... --tag <name>` (repeatable)
- Remove tags: `of task update ... --remove-tag <name>`
- Inbox mutation: `of inbox process <id> --tag <name>` or `--remove-tag <name>`

## Safe Workflow

1. Discover exact tag names first (`of tag list --search ... --json`).
2. Apply or mutate only after exact match is known.
3. For delete operations, run without `--confirm` first when you need impact preview.
