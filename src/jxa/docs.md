# Noridoc: jxa

Path: @/src/jxa

### Overview

- Contains the sole JXA (JavaScript for Automation) bridge script that communicates with OmniFocus.app via Apple Events.
- Executes as a standalone `osascript` process — receives a JSON command string as argv, returns a JSON result string.
- Purely synchronous; no async, no imports, no module system — constrained by the JXA runtime.

### How it fits into the larger codebase

- Invoked exclusively by `@/src/core/bridge.ts`, which shells out via `osascript -l JavaScript` and passes the command JSON as the first argument.
- Every CLI command in `@/src/commands/` ultimately bottlenecks through this single file — it is the only code that touches OmniFocus.app.
- Returns structured JSON that `bridge.ts` parses into typed `BridgeResponse<T>` objects for the rest of the TypeScript codebase to consume.
- The operation namespace (e.g. `task.create`, `project.get`) forms a stable contract between the TypeScript client layer and this script; adding a new CLI command that needs OmniFocus data means registering a new handler here.

### Core Implementation

- **JSON protocol**: Input is `{ op, params }`. Output is always `{ ok: true, data }` on success or `{ ok: false, error, candidates? }` on failure. The `candidates` field appears when entity lookup is ambiguous, enabling the CLI to present choices.
- **Dispatcher**: The `run(args)` entry point parses the JSON argument, obtains the OmniFocus `Application` and its `defaultDocument`, looks up a handler in the `ops` registry by `cmd.op`, and calls `handler(of, doc, params)`. Unrecognized ops and uncaught exceptions are caught and returned as `fail()` responses.
- **Ops registry**: A plain `var ops = {}` object where each handler is registered as `ops["domain.action"] = function(of, doc, p) { ... }`. Domains include `task`, `project`, `tag`, `folder`, `inbox`, plus top-level ops like `forecast`, `review`, `stats`, `bulk.*`, and `collect`. Notification CRUD is exposed via `task.notification.*`.
- **Fuzzy entity resolution**: Lookup functions (`findExistingTag`, `findExistingProject`, `findTaskByQuery`) follow a consistent three-tier strategy: exact match → case-insensitive substring match → ambiguity error with up to 10 candidate names. `findTaskByQuery` adds an ID-based lookup as the first tier.
- **Batch property access is required, not just an optimization**: `task.list` (both the inbox and non-inbox branches) and `stats` fetch each needed property as a whole array in one call (e.g. `doc.flattenedTasks.completed()`, `ft.dueDate()`) and index into the arrays, instead of calling a property accessor per task per property. On large databases (thousands of tasks), the per-task-per-property form issues one Apple Event per call and times out — `stats` and `task list --filter overdue` were unusable (60s/30s timeouts) before this was applied; `forecast`/`review` already used the batch form. `formatTask()` is only invoked for tasks that already passed the filter, using a lazily-materialized `ft()` element-array reference for the final read.
- **Property application**: `applyTaskProps` is a shared function that batch-applies a parameter bag (due, defer, flag, tags, repeat, estimate, etc.) to a task, returning an array of human-readable change descriptions. Tag and repeat operations that fail are recorded as soft warnings rather than aborting the operation.
- **Notification bridge path**: Task notifications are implemented through `of.evaluateJavascript(...)` (Omni Automation `Task.Notification`) because Apple Event task objects do not expose notification properties directly.
- **`limit` caps returned results, not the scan window**: `task.list` (inbox and non-inbox branches) scans until it has collected `limit` matching results rather than stopping after scanning `limit` raw entries. `doc.inboxTasks` keeps completed tasks until cleanup, and they can occupy the front of the collection — capping the scan window instead of the result count previously caused `inbox list --limit N` to return an empty list on databases with enough completed tasks up front. `task.list` also validates the filter name before entering the loop, so an unknown filter fails immediately even against an empty database.

### Things to Know

- **Defensive property access everywhere**: Nearly every JXA property read is wrapped in `try/catch` because OmniFocus objects can throw when properties are inaccessible (e.g., `effectiveDueDate` on tasks in certain states, `plannedDate` on older OmniFocus versions). The catch blocks return safe defaults (`null`, `false`, `0`).
- **Soft failure in batch operations**: `bulk.create`, `bulk.update`, and `bulk.complete` process each item independently, collecting per-item `{ ok, ... }` results. A single item failure does not abort the batch.
- **Date parsing is manual**: `parseDate` handles `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM` formats explicitly with string splitting (no `Date.parse`), falling back to `new Date(str)` for other formats. This avoids timezone ambiguity in the JXA runtime.
- **No ES6**: The entire file uses `var`, `function`, and `for` loops — JXA's JavaScript engine is pre-ES6. No `let`/`const`, arrow functions, template literals, or destructuring.
- **Strict capability behavior for notifications**: notification-enabled read/mutation paths fail explicitly if the OmniFocus runtime does not support `Task.Notification`.
- **`collect` op enriches tasks**: Beyond standard formatting, it parses spoon cost, priority, and rigidity from task names and tags — metadata conventions specific to the user's OmniFocus workflow.
- **Ambiguity is an error, not a guess**: When multiple entities match a fuzzy lookup, the bridge returns an error with candidates rather than silently picking one. This is a deliberate design invariant that pushes disambiguation to the CLI layer.
- **`stats.tasks.inbox` counts only unprocessed inbox items**: it filters `doc.inboxTasks` down to incomplete entries (via batch `.completed()`) rather than reporting the raw `inboxTasks` count, which includes completed items lingering until cleanup and would otherwise overstate the unprocessed inbox size.

Created and maintained by Nori.
