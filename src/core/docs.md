# Noridoc: core

Path: @/src/core

### Overview
- Foundation layer providing the domain type system, OmniFocus bridge transport, client abstraction, error hierarchy, and output formatting for the entire CLI.
- Every command in `@/src/commands` depends on this layer; this layer depends on nothing internal except `@/src/jxa/bridge.js` (the JXA script it shells out to).
- Establishes a strict boundary: TypeScript never talks to OmniFocus directly — all Apple Event communication is funneled through a single `osascript` invocation path.

### How it fits into the larger codebase
- Commands import `createClient()` to get an `OmniFocusClient`, then call its methods (e.g., `client.createTask()`, `client.forecast()`). They never touch the bridge directly.
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
- **Transport**: `executeBridge()` spawns `/usr/bin/osascript -l JavaScript` with the bridge script path and JSON command as argv. It applies a 30s default timeout and 10MB maxBuffer. Timeout, empty response, stderr-only output, and malformed JSON all surface as `JXAExecutionError`.
- **Client factory**: `createClient()` returns an object satisfying `OmniFocusClient`. Each method is a thin wrapper that constructs a `BridgeCommand` with the appropriate `op` string (e.g., `"task.create"`, `"project.list"`, `"forecast"`) and delegates to `executeBridge()`. Heavy operations (forecast, review, stats) use 60s timeouts; bulk operations use 120s.
- **Response unwrapping**: `unwrapBridgeResponse()` converts `{ ok: false }` responses into thrown `BridgeError` instances, preserving disambiguation candidates for display.
- **Output dual-mode**: `resolveFormat()` returns `"json"` if `--json` is passed or stdout is not a TTY, otherwise `"human"`. Every entity type (task, project, tag, folder) has both a line formatter (for lists) and a detail formatter, plus a list outputter that handles the empty-state message and count footer.
- **Error hierarchy**: `CLIError` is the base (message + exitCode). `BridgeError` carries optional `candidates[]` for "did you mean?" disambiguation. `JXAExecutionError` carries stderr. Specialized errors (`AmbiguousMatchError`, `NotFoundError`, `MissingArgumentError`, `ConfirmationRequiredError`) encode specific failure modes with appropriate exit codes.

### Things to Know
- `parseIntOption()` exists because Commander's custom parser signature `(value, previous)` collides with `parseInt(string, radix)` — passing `parseInt` directly uses the previous value as the radix, producing wrong results.
- `executeBridgeOrThrow()` lazily imports `client.js` to avoid a circular dependency between bridge and client modules.
- The bridge validates response shape beyond just JSON parsing — it checks for the `ok` boolean field and rejects structurally invalid payloads as `JXAExecutionError`.
- `BridgeError.format()` renders disambiguation candidates in a "Did you mean:" list, handling both simple string candidates and structured `{ name, project?, id? }` objects.
- Output format auto-detection means piped commands silently switch to JSON — commands do not need to handle this explicitly, they just pass the resolved format through.
- Color helpers (`bold`, `dim`, `red`, etc.) are re-exported from the output module for use by specialized formatters in command files (e.g., the forecast formatter).

Created and maintained by Nori.
