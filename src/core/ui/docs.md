# Noridoc: core/ui

Path: @/src/core/ui

### Overview
- Entity-agnostic terminal toolkit: ANSI color primitives, terminal-capability detection, and the progress spinner. Knows nothing about OmniFocus domain types (tasks, projects, ...) — that knowledge lives one level up in `@/src/core/output.ts`.
- Sits directly beneath `@/src/core/output.ts` in the core layer: `output.ts` composes these primitives into entity renderers; commands never import from here directly except for the color helpers.
- The intended home for future UI primitives (tables, symbols, boxes) — new chrome goes here as another entity-agnostic module, composed by `output.ts`, not built ad hoc inside a command file.

### How it fits into the larger codebase
- `@/src/core/output.ts` imports `bold`, `dim`, `red`, `green`, `yellow`, `cyan` from `./ui/colors.ts` and uses them to build its `✗`/`!` prefixes and entity formatters. It does not re-export them.
- `@/src/commands/*` files that need raw color helpers for their own formatting (e.g. the forecast bucket renderer) import directly from `@/src/core/ui/colors.ts` rather than through `output.ts`.
- `@/src/program.ts`'s `buildProgram()` installs a Commander `preAction` hook that calls `setProgressEnabled()` (from `progress.ts`) based on the resolved output format — this is the only place progress is turned on. `@/src/index.ts` is the only place `withProgress()` is applied, wrapping the client returned by `createClient()` before it reaches `buildProgram()`.
- `progress.ts` depends on `OmniFocusClient` (`@/src/core/types.ts`) for its decorator shape but calls none of its methods directly — it wraps whatever client it's given.

### Core Implementation
- **`colors.ts`**: ANSI code constants plus `colorEnabled(stream)` and `paint(code, s, stream?)`. Named helpers (`bold`, `dim`, `red`, `green`, `yellow`, `blue`, `cyan`) default to `process.stdout` but accept an optional second `stream` argument so stderr-rendered chrome (errors, warnings) can be gated on stderr's own TTY state rather than stdout's. `colorEnabled` follows `NO_COLOR`/`FORCE_COLOR` conventions checked per call, then falls back to `stream.isTTY`.
- **`terminal.ts`**: `isInteractive(stream)` — true only when `stream.isTTY === true`, `TERM` isn't `"dumb"`, and `CI` isn't set. Deliberately stricter than a bare TTY check: CI logs and dumb terminals can't render in-place redraws, so animated output there would just be noise. The `TerminalStream` interface (`{ isTTY?: boolean }`) is the minimal shape this and `progress.ts` need from a stream, letting tests substitute a fake object instead of a real `WriteStream`.
- **`progress.ts`**: `withProgress(client, opts?)` wraps an `OmniFocusClient` in a `Proxy` that shows a spinner on `opts.stream` (default `process.stderr`) around every async method call, stopping it in a `finally` regardless of success or failure — the spinner is never persisted, only the command's own output or `outputError()` result is. Two independent gates must both pass before anything draws: the module-level `progressEnabled` flag (`setProgressEnabled()`/`isProgressEnabled()`, off by default) and `isInteractive(stream)`. `DEFAULT_PROGRESS_LABEL` and the per-method `PROGRESS_LABELS` map give each client operation (forecast, review, stats, bulk ops, the various list/search ops) a specific in-flight message; caller-supplied `labels` merge over the defaults. The spinner library (`yocto-spinner`) is imported with a dynamic `import()` inside `startSpinner()`, reached only once a spinner is actually about to draw — a JSON-mode run never evaluates the module at all, so it pays no cost for stream hooking, signal handlers, or timers it will never use.

### Things to Know
- **Gotcha driving the double gate**: `yocto-spinner`, given a non-interactive stream, still prints its label once as a plain line rather than staying silent — that would violate the CLI's "piped stderr is one JSON object per line" contract (see `@/src/core/docs.md`). `progress.ts` therefore checks `isInteractive()` itself before ever constructing a spinner, rather than trusting the library's own detection.
- `withProgress`'s `Proxy` forwards every property that isn't a function unchanged (so non-method fields on a client shape still work) and only intercepts function-typed properties.
- An `{ ok: false }` bridge response is a normal resolved value passed through the proxy, not a thrown error — the spinner's `finally` handles both outcomes identically; only a thrown rejection propagates unchanged.
- The library choice (`yocto-spinner` over `ora`/`nanospinner`/`clack`/`ink`) favored a small, stderr-default spinner whose conventions already match this repo's hand-rolled TTY/`NO_COLOR` gating; a full TUI framework (`ink`) was rejected because this is a one-shot print-and-exit CLI, not a live-updating terminal app.

Created and maintained by Nori.
