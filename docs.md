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
- **Bridge** (`src/core/bridge.ts` + `src/jxa/bridge.js`): `executeBridge()` calls `/usr/bin/osascript` with the unified JXA script. JSON command in, JSON response out. Single choke point for all OmniFocus communication.

### Command Structure

Noun-verb pattern: `of <noun> <verb> [args] [options]`

| Command Group | Verbs | Example |
|---------------|-------|---------|
| `task` | add, list, update, complete, delete, search, show, subtask, tag | `of task add "Buy milk" --due 2026-03-05 --flag` |
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
├── index.ts                    # Entry: creates program, registers commands
├── commands/                   # CLI layer (thin: parse → service → format)
│   ├── task/                   # add, list, update, complete, search, show, subtask, tag
│   ├── project/                # add, list, show, update, rename, delete
│   ├── tag/                    # add, list, rename, delete, tasks
│   ├── folder/                 # add, list
│   ├── inbox/                  # list, add, process
│   ├── bulk/                   # create, update, complete
│   ├── forecast.ts
│   ├── review.ts
│   └── stats.ts
├── services/                   # Business logic (pure TS, injectable client)
├── core/
│   ├── types.ts                # All domain types, OmniFocusClient interface
│   ├── errors.ts               # Error hierarchy (CLIError, BridgeError, etc.)
│   ├── bridge.ts               # osascript executor, JSON protocol handler
│   ├── client.ts               # OmniFocusClient implementation
│   └── output.ts               # Formatters for human/JSON output
└── jxa/
    └── bridge.js               # Unified JXA script (~1150 lines, all OmniFocus ops)

test/
├── core/                       # Unit tests for core modules
│   ├── client.test.ts
│   ├── errors.test.ts
│   └── output.test.ts
├── integration/
│   └── cli.test.ts             # Integration tests (mock client, real Commander parsing)
└── fixtures/
    └── mock-responses.ts       # Shared test fixtures
```

### Core Types

- `OFTask`, `OFProject`, `OFTag`, `OFFolder` — Domain entities
- `BridgeCommand` — `{ op: string; params: Record<string, unknown> }` sent to JXA
- `BridgeResponse<T>` — `{ ok: true; data: T } | { ok: false; error: string }`
- `OmniFocusClient` — Interface with all operations, implemented by `createClient()`
- `TaskFilter` — `"inbox" | "available" | "flagged" | "due-soon" | "overdue" | "all"`

### JXA Bridge Protocol

The bridge (`src/jxa/bridge.js`) receives a JSON command as the first osascript argument:

```
Input:  { "op": "task.create", "params": { "name": "Buy groceries", "due": "2026-03-05" } }
Output: { "ok": true, "data": { "id": "...", "name": "Buy groceries", "task": { ... } } }
```

Operations: `task.create`, `task.get`, `task.update`, `task.complete`, `task.delete`, `task.list`, `task.search`, `task.subtask`, `task.applyTag`, `project.create`, `project.get`, `project.list`, `project.update`, `project.rename`, `project.delete`, `tag.create`, `tag.list`, `tag.rename`, `tag.delete`, `tag.tasks`, `folder.create`, `folder.list`, `inbox.list`, `inbox.add`, `inbox.process`, `bulk.create`, `bulk.update`, `bulk.complete`, `forecast`, `review`, `stats`, `collect.completed`

### Error Hierarchy

- `CLIError` — Base class with exitCode
- `BridgeError` — Wraps bridge `{ ok: false }` responses
- `JXAExecutionError` — osascript process failure (timeout, crash, syntax error)
- `NotFoundError`, `AmbiguousMatchError` — Task/project/tag lookup failures
- `MissingArgumentError`, `ConfirmationRequiredError` — Input validation

### Things to Know

**Single JXA bridge handles all OmniFocus communication.** `bridge.js` is the sole entry point — a unified script handling all operations via a JSON command protocol. All Apple Event logic lives here; everything else is TypeScript.

**`plannedDate` is guarded everywhere.** Added for OmniFocus 4.7+, every access is wrapped in try/catch. The distinction between `deferDate` (hidden until date) and `plannedDate` (scheduled but available) is significant: forecast treats `planned_today` as the primary "what to do today" bucket.

**Spoon budget is a fixed baseline of 20.** `forecast` hardcodes this and computes remaining spoons from today's tasks. Spoon costs map emoji to numeric values (frog=10, hard=7, medium=4, low=1.5, recharge=-5).

**Performance pattern:** Read-heavy operations (forecast, list tasks, weekly review) use batch property access — reading all values for a property in a single Apple Event (`doc.flattenedTasks.name()`) — then indexing into arrays. Per-task calls deferred to a second pass over filtered results.

**Task lookup cascade:** Tries ID first (fast path via `flattenedTasks.byId`), then exact name, then substring. On ambiguity, returns up to 5 candidates with IDs for disambiguation.

**All tag/project references use strict lookup.** Never auto-creates — returns `{ error, candidates? }` on failure. Tag creation only via `of tag add`, project creation only via `of project add`.

### Development

```bash
bun test              # Run all tests (45 tests)
bun run check         # Biome lint + format check
bun run typecheck     # TypeScript strict checks
bun run build         # Compile to single binary: ./of
bun run dev -- task list --json   # Run CLI in dev mode
```

Created and maintained by Nori.