# OmniFocus Automation Guide (CLI Era)

This repository now uses a unified CLI surface (`of ...`) rather than direct per-operation `osascript` calls.

## Use This First

- `of task ...` for task CRUD/search/subtasks/tags
- `of task notification ...` for task reminder/notification CRUD
- `of inbox ...` for capture and triage
- `of project ...` and `of folder ...` for structure
- `of tag ...` for tag namespace operations
- `of forecast`, `of review`, `of stats` for operational reporting
- `of bulk ...` for stdin JSON batch operations

## Legacy Note

Historical JXA files remain in `src/*.js` for migration traceability only.

Agent guidance should target the TypeScript command architecture in `src/commands/` and `src/core/`.

Notification notes:
- Notification offsets/repeats use duration syntax (`-1h`, `30m`, `1h30m`, `90s`, `+2h15m`) at the CLI layer.
- Bridge implementation uses Omni Automation (`evaluate javascript`) internally for notifications.
