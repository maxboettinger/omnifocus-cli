---
name: omnifocus-forecast
description: "Reporting and execution views for omnifocus-cli. Use for daily forecast, weekly review, and global stats, then drive follow-up task updates."
---

# OmniFocus Forecast And Reviews (CLI)

Use this skill for read-heavy operational views and execution support.

## Report Commands

- Daily/near-term view: `of forecast [--days N] [--include-flagged] [--include-available] [--json]`
- Weekly retrospective: `of review [--days N] [--json]`
- System snapshot: `of stats [--json]`

## Recommended Agent Pattern

1. Start with `of forecast --json` for current execution state.
2. If user requests trend/progress, run `of review --json`.
3. If user asks for high-level health, run `of stats --json`.
4. Convert findings into concrete follow-up actions using `of task update`, `of task complete`, `of task notification ...`, or `of inbox process`.

## Practical Defaults

- Use `--days 3` for normal forecast horizon.
- Add `--include-available` when user asks what to do next.
- Add `--include-flagged` when priority/urgency routing is requested.
