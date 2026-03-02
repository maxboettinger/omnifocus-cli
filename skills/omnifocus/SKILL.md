---
name: omnifocus
description: "Primary OmniFocus skill router for agents. Use for any OmniFocus request. Enforces CLI-first safety rules and routes work to task, inbox, project, tag, and reporting skills."
---

# OmniFocus Router (CLI-First)

Use this skill whenever a request touches OmniFocus.

## Scope

This skill is the orchestration layer. It decides which specialized skill to load:

- `omnifocus-tasks` for tasks, inbox operations, and bulk edits
- `omnifocus-projects` for projects and folders
- `omnifocus-tags` for tag discovery and management
- `omnifocus-forecast` for forecast, review, and stats
- `omnifocus-inbox` for capture from natural-language input
- `omnifocus-process` for inbox triage sessions
- `omnifocus-plan` for planning and re-estimation workflows

## Core Rules

1. Use the `of` CLI, not direct `osascript` script calls.
2. Prefer `--json` for machine-readable agent workflows.
3. Prefer ID-based updates when available (`--id`) to avoid ambiguity.
4. Discover before mutating:
- Search/list first, then add/update/delete.
5. Use explicit dates (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`) when setting due/defer/planned values.
6. Treat destructive operations as two-step flows:
- preview/discover -> confirm delete (`--confirm`) -> execute.

## Command Map

- Tasks: `of task ...`
- Inbox: `of inbox ...`
- Projects: `of project ...`
- Tags: `of tag ...`
- Folders: `of folder ...`
- Reports: `of forecast`, `of review`, `of stats`
- Bulk stdin JSON: `of bulk create|update|complete`

## Legacy Note

The repository still contains old JXA files under `src/*.js` for migration history. For agent behavior, treat those as legacy implementation artifacts and use the CLI command surface in `src/commands/`.
