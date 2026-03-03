---
name: omnifocus-inbox
description: "Natural-language capture workflow for omnifocus-cli. Use when users ask to add/capture tasks or paste mixed notes/brain dumps that need conversion into inbox or task entries."
---

# OmniFocus Capture Workflow

Use this skill for converting user input into actionable OmniFocus entries.

## Capture Protocol

1. Parse input into atomic action items.
2. Keep each task verb-first and specific.
3. Capture with `of inbox add` by default.
4. Use `of task add --project <name>` only when the user clearly wants direct project placement.
5. When a request contains multi-step execution, create a parent item and children via `of task subtask`.

## Command Patterns

- Single capture: `of inbox add "<task>" [metadata flags] --json`
- Multi-capture: run one command per extracted item (or use `of bulk create` if input is already structured)
- Immediate project placement: `of task add "<task>" --project "<project>" --json`

## Clarification Rules

Ask follow-up questions only when one of these blocks execution:

- Missing task text/action
- Ambiguous target project/tag with multiple likely matches
- Conflicting due/defer/planned intent

Otherwise, capture first and refine later with `of inbox process` or `of task update`.

If reminders are requested during refinement, use `of task notification add|update ...` after task identity is stable.
