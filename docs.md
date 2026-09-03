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

- **CLI** (`src/commands/`): Commander.js wires args to client calls, formats output. Each noun (task, project, tag, folder, inbox, bulk) is a `defineNoun()` literal (`@/src/commands/noun.ts`) carrying a one-letter alias (`t`, `p`, `g`, `f`, `i`, `b`) and a directory with one file per verb; there is no root mounting of noun verbs, so a verb lives at exactly one place in the tree. Verbs share flag/argument declarations from `@/src/commands/options/` and error/format handling from `runAction()` rather than each redeclaring them. Thin: parse args, call client, format output.
- **Client** (`src/core/client.ts`): Implements `OmniFocusClient` interface. Each method maps to a bridge operation. All methods return `BridgeResponse<T>`. Injectable/mockable for tests.
- **Bridge** (`src/core/bridge.ts` + `src/jxa/bridge.js`): `executeBridge()` calls `osascript`, passing the JXA script source (embedded via a Bun text import, not a file path — required so the standalone compiled binary can find it) via `-e`. JSON command in, JSON response out. Single choke point for all OmniFocus communication.

Program assembly is split from the executable entry point: `@/src/program.ts` exports `buildProgram(client)`, which constructs the full Commander program (all noun/verb registrations) without parsing `argv` — this lets tests build a real program against a mock client with no process side effects. `@/src/index.ts` is a thin executable: build a real client, `buildProgram(client)`, `parseAsync`, with top-level error handling that maps `CLIError` to `outputError()` + its exit code. The CLI's version is single-sourced from `package.json` — `program.ts` imports it directly (`import pkg from "../package.json" with { type: "json" }`) and sets `.version(pkg.version)`, so there is no separately hardcoded version string anywhere else.

### Command Structure

Noun-verb pattern: `of <noun> <verb> [args] [options]`

| Command Group | Alias | Verbs | Example |
|---------------|-------|-------|---------|
| `task` | `t` | add, list, update, move, complete, delete, search, show, tag, notification | `of task add "Buy milk" --due 2026-03-05 --flag` |
| `project` | `p` | add, list, show, update, rename, delete | `of project list --status active` |
| `tag` | `g` | add, list, rename, delete, tasks | `of tag tasks "errand" --json` |
| `folder` | `f` | add, list | `of folder add "Personal" --parent "Life"` |
| `inbox` | `i` | list, add, process, process-many | `of inbox list --limit 10` |
| `bulk` | `b` | add, update, complete | `echo '[...]' \| of bulk add` |
| `forecast` | `fc` | (top-level) | `of forecast --days 3` |
| `review` | — | (top-level) | `of review` |
| `stats` | — | (top-level) | `of stats --json` |
| `collect` | — | (top-level) | `of collect --days 7` |

Every noun's one-letter alias works anywhere the full name does (`of t list` = `of task list`); every verb carries a one-letter alias within its noun (`of t c 42` = `of task complete 42`), and there are no root-level verb shortcuts. A standalone top-level command can carry its own short alias declared inline with `.alias()` — `forecast` is `fc`, since `f` is already taken by the `folder` noun — independent of the one-letter noun/verb alias scheme. `task add`'s `--parent`/`--parent-id` create a subtask (folded from the former `task subtask`); `inbox add` is the same `registerAddCommand` as `task add`, mounted a second time under `inbox` rather than reimplemented. `--json` is a single root-level option (`@/src/program.ts`), not redeclared per verb.

### Directory Structure

```
src/
├── index.ts                    # Executable entry: build client, buildProgram(), parseAsync
├── program.ts                  # buildProgram(client) — full Commander assembly, no argv side effects
├── commands/                   # CLI layer (thin: parse → service → format)
│   ├── noun.ts                  # defineNoun() — the one noun registrar (alias, verbs)
│   ├── options/                 # shared flag/argument groups (common, refs, task-fields)
│   ├── task/                    # add, list, update, move, complete, search, show, notification/*, tag
│   ├── project/                 # add, list, show, update, rename, delete
│   ├── tag/                     # add, list, rename, delete, tasks
│   ├── folder/                  # add, list
│   ├── inbox/                   # list, add (= task/add.ts), process, process-many
│   ├── bulk/                    # add, update, complete
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
│   ├── short-ids.ts            # Persistent numeric alias cache (human-mode only)
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

Operations: `task.create`, `task.get`, `task.update`, `task.complete`, `task.delete`, `task.list`, `task.search`, `task.applyTag`, `task.notification.list`, `task.notification.add`, `task.notification.update`, `task.notification.delete`, `task.notification.clear`, `project.create`, `project.get`, `project.list`, `project.update`, `project.rename`, `project.delete`, `tag.create`, `tag.list`, `tag.rename`, `tag.delete`, `tag.tasks`, `folder.create`, `folder.list`, `inbox.list`, `inbox.process`, `bulk.create`, `bulk.update`, `bulk.complete`, `forecast`, `review`, `stats`, `collect.completed`

`task.create` and `bulk.create` (the bridge op backing the `bulk add` verb — the op name itself is unchanged) both build their task through a shared `createTaskRecord()` helper, which resolves `project` or `parent`/`parentId` (mutually exclusive) before creating the task; there is no separate `task.subtask` or `inbox.add` op — `task add`'s `--parent`/`--parent-id` cover subtask creation, and `inbox add` is the same command as `task add`, mounted a second time.

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

**Every human-mode task listing shows a short numeric alias.** `@/src/core/short-ids.ts` caches a monotonic `OmniFocus id → number` map on disk so a number seen in one command (`of task list`) stays valid for a later one (`of task complete 42`). This is human-mode-only decoration — JSON output and the bridge protocol are untouched, and only `@/src/commands/` and `@/src/core/output.ts` know the cache exists. See `@/src/core/docs.md` for the mechanism.

### Development

```bash
bun test              # Run all tests
bun run check         # Biome lint + format check
bun run typecheck     # TypeScript strict checks
bun run build         # Compile to single binary: ./of
bun run dev -- task list --json   # Run CLI in dev mode
scripts/build-release.sh          # Both Mac binaries + checksums into dist/
```

### Release & distribution

- Distribution is Bun-required source (`bun link`, npm package `omnifocus-cli` whose `bin` runs `src/index.ts` under Bun) plus standalone binaries compiled with `bun build --compile` for `bun-darwin-arm64` and `bun-darwin-x64`, attached to each GitHub release and served through the Homebrew tap `maxboettinger/homebrew-tap` (`brew install maxboettinger/tap/omnifocus-cli`).
- `@/.github/workflows/release.yml` runs on a `v*` tag push: it checks the tag against `package.json`'s version, runs the CI gates, then builds (`@/scripts/build-release.sh`), creates the GitHub release with notes assembled by `@/scripts/release-notes.sh` from the matching `CHANGELOG.md` section, publishes to npm via trusted publishing, and regenerates the tap formula with `@/scripts/homebrew-formula.sh` (sha256 values are read from `checksums.txt`, never typed). The workflow, not a human, is the only writer of the formula.

Created and maintained by Nori.
