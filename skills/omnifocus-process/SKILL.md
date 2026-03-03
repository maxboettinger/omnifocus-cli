---
name: omnifocus-process
description: "Inbox triage workflow for omnifocus-cli. Use to process existing inbox items in batches with deterministic inbox list/process commands."
---

# OmniFocus Inbox Triage Workflow

Use this skill when the goal is to process existing inbox items, not create new ones.

## Triage Loop

1. Load inbox batch:
- `of inbox list --limit 25 --json`
2. Classify each item:
- keep and enrich
- move to project
- complete
- delete
- split into subtasks
3. For risky edits, preview with:
- `of inbox process <id> ... --dry-run --json`
4. Apply confirmed mutation with:
- `of inbox process <id> ... --json`
5. Verify by re-listing inbox and showing updated tasks.

## Common Mutations

- Rename + metadata: `of inbox process <id> --name "..." --tag "..." --estimate 15 --json`
- Move to project: `of inbox process <id> --project "..." --json`
- Complete: `of inbox process <id> --complete --json`
- Delete: `of inbox process <id> --delete --json`
- Add schedule: `of inbox process <id> --due YYYY-MM-DD --planned YYYY-MM-DD --json`
- Add reminder after project placement: `of task notification add --id <task-id> --kind absolute --at YYYY-MM-DDTHH:MM --json`

## Batch Discipline

- Process in small batches to reduce accidental destructive changes.
- Prefer explicit item IDs for every mutation.
