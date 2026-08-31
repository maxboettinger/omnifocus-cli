# Noridoc: omnifocus-cli

Path: @/omnifocus-cli

### Overview

`omnifocus-cli` is a TypeScript CLI (binary name: `of`) for managing OmniFocus from the terminal. Built on Bun + Commander.js, it wraps a single unified JXA bridge script (`src/jxa/bridge.js`) that handles all Apple Event communication with OmniFocus.app.

### Architecture

```
  CLI Layer (Commander.js)        Client Layer (TypeScript)         Data Access (JXA)
  ┌──────────────────┐            ┌─────────────────────┐          ┌─────────────┐
  │ of task add       │──────────▶│ client.createTask()  │────────▶│             │
  │ of forecast       │──────────▶│ client.forecast()    │────────▶│ bridge.js   │
  │ of project list   │──────────▶│ client.listProjects()│────────▶│ (single JXA │
  │ of inbox process  │──────────▶│ client.processInbox()│────────▶│  script)    │
  └──────────────────┘            └─────────────────────┘          └──────┬──────┘
         ↓                               ↓                               │
    Arg parsing                    Bridge executor                  Apple Events
    Help text                      Response unwrapping              OmniFocus.app
    Output formatting              Error translation
    Error presentation
```

Three clean layers, each testable independently:

- **CLI** (`src/commands/`): Commander.js wires args to client calls, formats output. Each noun (task, project, tag, folder, inbox, bulk) is a directory with one file per verb. Thin: parse args, call client, format output.
- **Client** (`src/core/client.ts`): Implements `OmniFocusClient` interface. Each method maps to a bridge operation. All methods return `BridgeResponse<T>`. Injectable/mockable for tests.
- **Bridge** (`src/core/bridge.ts` + `src/jxa/bridge.js`): `executeBridge()` calls `osascript`, passing the JXA script source (embedded via a Bun text import, not a file path — required so the standalone compiled binary can find it) via `-e`. JSON command in, JSON response out. Single choke point for all OmniFocus communication.

Program assembly is split from the executable entry point: `@/src/program.ts` exports `buildProgram(client)`, which constructs the full Commander program (all noun/verb registrations) without parsing `argv` — this lets tests build a real program against a mock client with no process side effects. `@/src/index.ts` is a thin executable: build a real client, `buildProgram(client)`, `parseAsync`, with top-level error handling that maps `CLIError` to `outputError()` + its exit code. The CLI's version is single-sourced from `package.json` — `program.ts` imports it directly (`import pkg from "../package.json" with { type: "json" }`) and sets `.version(pkg.version)`, so there is no separately hardcoded version string anywhere else.

### Command Structure

Noun-verb pattern: `of <noun> <verb> [args] [options]`

| Command Group | Verbs | Example |
|---------------|-------|---------|
| `task` | add, list, update, complete, delete, search, show, notification, subtask, tag | `of task add "Buy milk" --due 2026-03-05 --flag` |
| `project` | add, list, show, update, rename, delete | `of project list --status active` |
| `tag` | add, list, rename, delete, tasks | `of tag tasks "errand" --json` |
| `folder` | add, list | `of folder add "Personal" --parent "Life"` |
| `inbox` | list, add, process | `of inbox list --limit 10` |
| `bulk` | create, update, complete | `echo '[...]' \| of bulk create` |
| `forecast` | (top-level) | `of forecast --days 3` |
| `review` | (top-level) | `of review` |
| `stats` | (top-level) | `of stats --json` |
| `collect` | (top-level) | `of collect --days 7` |

All commands support `--json` for machine-readable output (globally or per-command).

### Directory Structure

```
src/
├── index.ts                    # Executable entry: build client, buildProgram(), parseAsync
├── program.ts                  # buildProgram(client) — full Commander assembly, no argv side effects
├── commands/                   # CLI layer (thin: parse → service → format)
│   ├── task/                   # add, list, update, complete, search, show, notification/*, subtask, tag
│   ├── project/                # add, list, show, update, rename, delete
│   ├── tag/                    # add, list, rename, delete, tasks
│   ├── folder/                 # add, list
│   ├── inbox/                  # list, add, process, process-many
│   ├── bulk/                   # create, update, complete
│   ├── completion.ts
│   ├── forecast.ts
│   ├── review.ts
│   └── stats.ts
├── core/
│   ├── types.ts                # All domain types, OmniFocusClient interface
│   ├── errors.ts               # Error hierarchy (CLIError, BridgeError, etc.)
│   ├── bridge.ts               # osascript executor, JSON protocol handler
│   ├── client.ts               # OmniFocusClient implementation
│   ├── output.ts               # Formatters for human/JSON output
│   └── stdin.ts                # Shared TTY-guarded stdin reader (bulk/process-many)
└── jxa/
    └── bridge.js               # Unified JXA script (~1150 lines, all OmniFocus ops)

test/
├── core/                       # Unit tests for core modules, incl. transport tests
├── integration/                # Mock-client integration tests (real Commander parsing)
├── jxa/                        # Direct tests of bridge.js op handlers
└── fixtures/                   # Shared mock domain objects, mock client, stub bridge binary
```

### Core Types

- `OFTask`, `OFTaskNotification`, `OFProject`, `OFTag`, `OFFolder` — Domain entities
- `BridgeCommand` — `{ op: string; params: Record<string, unknown> }` sent to JXA
- `BridgeResponse<T>` — `{ ok: true; data: T } | { ok: false; error: string }`
- `OmniFocusClient` — Interface with all operations, implemented by `createClient()`
- `TaskFilter` — `"inbox" | "available" | "flagged" | "due-soon" | "overdue" | "all"`
- `TaskNotification*Options` — typed options for notification CRUD command surface

### JXA Bridge Protocol

The bridge (`src/jxa/bridge.js`) receives a JSON command as the first osascript argument:

```
Input:  { "op": "task.create", "params": { "name": "Buy groceries", "due": "2026-03-05" } }
Output: { "ok": true, "data": { "id": "...", "name": "Buy groceries", "task": { ... } } }
```

Operations: `task.create`, `task.get`, `task.update`, `task.complete`, `task.delete`, `task.list`, `task.search`, `task.subtask`, `task.applyTag`, `task.notification.list`, `task.notification.add`, `task.notification.update`, `task.notification.delete`, `task.notification.clear`, `project.create`, `project.get`, `project.list`, `project.update`, `project.rename`, `project.delete`, `tag.create`, `tag.list`, `tag.rename`, `tag.delete`, `tag.tasks`, `folder.create`, `folder.list`, `inbox.list`, `inbox.add`, `inbox.process`, `bulk.create`, `bulk.update`, `bulk.complete`, `forecast`, `review`, `stats`, `collect.completed`

### Error Hierarchy

- `CLIError` — Base class with exitCode
- `BridgeError` — Wraps bridge `{ ok: false }` responses
- `JXAExecutionError` — osascript process failure (timeout, crash, syntax error)
- `ConfirmationRequiredError` — Destructive verbs missing `--confirm`
- Ambiguous/not-found lookup failures surface as `BridgeError` with `candidates?`, not a dedicated exception type

### Things to Know

**Single JXA bridge handles all OmniFocus communication.** `bridge.js` is the sole entry point — a unified script handling all operations via a JSON command protocol. All Apple Event logic lives here; everything else is TypeScript.

**`plannedDate` is guarded everywhere.** Added for OmniFocus 4.7+, every access is wrapped in try/catch. The distinction between `deferDate` (hidden until date) and `plannedDate` (scheduled but available) is significant: forecast treats `planned_today` as the primary "what to do today" bucket.

**Forecast filters on effective completion status.** A task inside a completed or dropped project keeps its own `completed` flag false; only `effectivelyCompleted`/`effectivelyDropped` reflect the container. The forecast op excludes tasks where either is true (guarded batch reads, falling back to the plain flag on older dictionaries), matching OmniFocus's own Forecast view. `task list`/`task search`/`stats` still filter on the plain flag. See `@/src/jxa/docs.md`.

**Performance pattern:** Read-heavy operations (forecast, task list, weekly review, stats, project get/list) use batch property access — reading all values for a property in a single Apple Event (`doc.flattenedTasks.name()`, or `project.flattenedTasks.completed()` scoped to one project) — then indexing into arrays, rather than calling a property accessor per task. This is required, not just faster: on large databases the per-task form issues one Apple Event per property per task and times out.

**Task lookup cascade:** Tries ID first (fast path via `flattenedTasks.byId`), then exact name, then substring. On ambiguity, returns up to 5 candidates with IDs for disambiguation.

**All tag/project references use strict lookup.** Never auto-creates — returns `{ error, candidates? }` on failure. Tag creation only via `of tag add`, project creation only via `of project add`.

**Task notifications use Omni Automation via the bridge.** Notification CRUD is implemented through OmniFocus `evaluate javascript` calls (`Task.Notification`) behind bridge ops. `task show` always includes notifications; `task list` includes them only for JSON output.

**Known first-run failures get translated into actionable guidance.** Two conditions a first-time user is likely to hit — Apple Events authorization denial (macOS error -1743) and OmniFocus not being installed/openable — are pattern-matched (`matchKnownBridgeFailure()` in `@/src/core/errors.ts`) and rewritten into guidance pointing at System Settings → Privacy & Security → Automation, or an install link, instead of surfacing raw osascript stderr. See `@/src/core/docs.md` for the call sites.

### Development

```bash
bun test              # Run all tests
bun run check         # Biome lint + format check
bun run typecheck     # TypeScript strict checks
bun run build         # Compile to single binary: ./of
bun run dev -- task list --json   # Run CLI in dev mode
```

Created and maintained by Nori.
