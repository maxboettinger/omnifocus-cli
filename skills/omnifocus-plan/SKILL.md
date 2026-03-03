---
name: omnifocus-plan
description: "Planning workflow for omnifocus-cli. Use to turn forecast/task data into a concrete execution plan by setting estimates, planned dates, and priority-focused task selections."
---

# OmniFocus Planning Workflow

Use this skill for daily/weekly planning sessions.

## Planning Flow

1. Snapshot current state:
- `of forecast --days 3 --include-flagged --include-available --json`
2. Pull candidate tasks:
- `of task list --filter overdue --limit 50 --json`
- `of task list --filter due-soon --limit 50 --json`
- `of task list --filter flagged --limit 50 --json`
3. Refine tasks:
- set estimates: `of task update --id <id> --estimate <minutes> --json`
- set/clear schedule: `of task update --id <id> --planned <date|clear> --due <date|clear> --defer <date|clear> --json`
- re-tag if needed: `of task update --id <id> --tag "..." --remove-tag "..." --json`
- manage reminders if needed: `of task notification add|update|delete|clear --id <id> ... --json`
4. Final validation:
- rerun `of forecast --days 3 --include-flagged --json`

## Planning Heuristics

- Prefer a short execution set over long optimistic plans.
- Keep estimates realistic and update them as soon as new information appears.
- Convert vague tasks into concrete subtasks before scheduling.
