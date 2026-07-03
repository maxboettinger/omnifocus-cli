# Noridoc: core

Path: @/src/core

### Overview
- Foundation layer providing the domain type system, OmniFocus bridge transport, client abstraction, error hierarchy, and output formatting for the entire CLI.
- Every command in `@/src/commands` depends on this layer; this layer depends on nothing internal except `@/src/jxa/bridge.js` (the JXA script it shells out to).
- Establishes a strict boundary: TypeScript never talks to OmniFocus directly — all Apple Event communication is funneled through a single `osascript` invocation path.

### How it fits into the larger codebase
- Commands import `createClient()` to get an `OmniFocusClient`, then call its methods (e.g., `client.createTask()`, `client.forecast()`, `client.addTaskNotification()`). They never touch the bridge directly.
- Commands use the output module's `resolveFormat()`, `outputTaskList()`, `outputSuccess()`, etc. to render results in either human (ANSI-colored TTY) or JSON (piped/scripted) mode.
- The error hierarchy is caught at the top-level CLI entrypoint (`@/src/index.ts`) to produce user-facing messages and correct exit codes.
- The `OmniFocusClient` interface in types is the seam for testing — commands depend on the interface, and tests inject mocks without touching the bridge.

```
┌──────────────┐
│  commands/*   │
└──────┬───────┘
       │ uses types, errors, output, parsers
       ▼
┌──────────────┐
│    client     │──→ OmniFocusClient interface (types)
└──────┬───────┘
       │ calls executeBridge()
       ▼
┌──────────────┐
│    bridge     │──→ osascript ──→ @/src/jxa/bridge.js ──→ OmniFocus.app
└──────────────┘
```

### Core Implementation
- **Bridge protocol**: Every operation is a `BridgeCommand { op, params }` sent as JSON to `osascript`. The response is always `{ ok: true, data }` or `{ ok: false, error, candidates? }`. This protocol is defined in types and enforced by `executeBridge<T>()`.
- **Transport**: `executeBridge()` spawns `/usr/bin/osascript -l JavaScript` with the JSON command as argv, passing the bridge script source via `-e` (a Bun text import of `@/src/jxa/bridge.js`, shebang stripped at load) rather than a file path — a filesystem path resolved via `import.meta.dirname` would point into Bun's virtual `/$bunfs/` filesystem inside a `bun build --compile` binary, invisible to the external `osascript` process. It applies a 30s default timeout and 10MB maxBuffer. Timeout, empty response, stderr-only output, and malformed JSON all surface as `JXAExecutionError`.
- **Client factory**: `createClient()` returns an object satisfying `OmniFocusClient`. Each method is a thin wrapper that constructs a `BridgeCommand` with the appropriate `op` string (e.g., `"task.create"`, `"task.notification.add"`, `"task.delete"`, `"project.list"`, `"forecast"`) and delegates to `executeBridge()`. Heavy operations (forecast, review, stats) use 60s timeouts; bulk operations use 120s. `listInbox(limit?, opts?)` takes an optional `{ newestFirst? }` bag spread directly into the `inbox.list` params, mirroring the bridge-side flag.
- **Response unwrapping**: `unwrapBridgeResponse()` converts `{ ok: false }` responses into thrown `BridgeError` instances, preserving disambiguation candidates for display.
- **Output dual-mode**: `resolveFormat()` returns `"json"` if `--json` is passed or stdout is not a TTY, otherwise `"human"`. Every entity type (task, project, tag, folder) has both a line formatter (for lists) and a detail formatter, plus a list outputter that handles the empty-state message and count footer.
- **Limit notice stays off stdout**: `outputLimitNotice(count, limit)` writes `showing N items (limit reached) — pass --limit <n> for more` to stderr (never stdout) when a list command's result count equals the limit it requested. `task list` and `inbox list` call it after `outputTaskList()`. Keeping it on stderr means stdout stays a clean parseable JSON array for pipelines, while interactive users and agents still see the truncation warning.
- **Error hierarchy**: `CLIError` is the base (message + exitCode). `BridgeError` carries optional `candidates[]` for "did you mean?" disambiguation, and is also how ambiguous-match and not-found failures surface — the bridge returns them as `{ ok: false, error, candidates? }` rather than the CLI layer throwing a dedicated exception type. `JXAExecutionError` carries stderr. `ConfirmationRequiredError` is the one specialized subclass, used by every destructive verb guard (`task delete`, `project delete`, `tag delete`, `task notification clear`) to produce a consistent message.

### Things to Know
- `parseIntOption()` exists because Commander's custom parser signature `(value, previous)` collides with `parseInt(string, radix)` — passing `parseInt` directly uses the previous value as the radix, producing wrong results.
- Duration parser helpers (`parseDurationToSeconds`, `parseDurationOrClear`) normalize notification offsets/repeat intervals from duration syntax (`-1h30m`, `2h`, `90s`) into seconds.
- The bridge validates response shape beyond just JSON parsing — it checks for the `ok` boolean field and rejects structurally invalid payloads as `JXAExecutionError`.
- `BridgeError.format()` renders disambiguation candidates in a "Did you mean:" list, handling both simple string candidates and structured `{ name, project?, id? }` objects.
- Output format auto-detection means piped commands silently switch to JSON — commands do not need to handle this explicitly, they just pass the resolved format through.
- Color helpers (`bold`, `dim`, `red`, etc.) are re-exported from the output module for use by specialized formatters in command files (e.g., the forecast formatter).

Created and maintained by Nori.
