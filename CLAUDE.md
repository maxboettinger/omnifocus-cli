# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Runtime is **Bun** (not Node). The CLI binary is `of`.

```bash
bun test                           # run all tests
bun test test/integration/         # integration tests only
bun test test/core/                # unit tests only
bun test test/core/parsers.test.ts # single test file
bun run check                      # Biome lint + format check (src/ and test/)
bun run format                     # Biome auto-format
bun run typecheck                  # tsc --noEmit (strict)
bun run build                      # compile standalone binary → ./of
bun run dev -- task list --json    # run the CLI in dev mode
```

There is no watch/CI script; run `check`, `typecheck`, and `test` before finishing work.

## Architecture

A macOS-only CLI that manages OmniFocus by shelling out to Apple Events. Strict three-layer boundary — **TypeScript never talks to OmniFocus directly**; all communication funnels through a single `osascript` invocation.

```
src/commands/*   (CLI layer, Commander.js)
      │ imports OmniFocusClient interface + output/error helpers
      ▼
src/core/client.ts  (OmniFocusClient — one method per bridge op)
      │ executeBridge() spawns osascript
      ▼
src/jxa/bridge.js   (single JXA script) ──→ OmniFocus.app
```

- **CLI layer** (`src/commands/`): Thin wrappers — parse args → call client → format output → catch errors. Nothing imports from `commands/`; it only imports from `src/core/`. Organized noun-verb: each noun (task, project, tag, folder, inbox, bulk) is a directory with an `index.ts` registering verb files. Standalone commands (forecast, review, stats, collect, completion) attach to the root program.
- **Client layer** (`src/core/client.ts`): `createClient()` returns an `OmniFocusClient`. Each method builds a `BridgeCommand { op, params }` (e.g. `"task.create"`, `"task.notification.add"`, `"forecast"`) and calls `executeBridge()`. Timeouts scale by op weight: 30s default, 60s for forecast/review/stats, 120s for bulk.
- **Bridge/transport** (`src/core/bridge.ts` + `src/jxa/bridge.js`): JSON command in, JSON response out. Response is always `{ ok: true, data }` or `{ ok: false, error, candidates? }`. `unwrapBridgeResponse()` turns `{ ok: false }` into a thrown `BridgeError` (preserving disambiguation candidates). Timeout/empty/malformed responses surface as `JXAExecutionError`.

### Dependency injection & the test seam

`OmniFocusClient` (interface in `src/core/types.ts`) is the seam. `createClient()` is called once in `src/index.ts` and threaded into every `register*Commands(program, client)`. Tests inject mock clients — **no OmniFocus or macOS required to run the suite**. Integration tests (`test/integration/`) verify the full parse-to-output flow against mocks.

`src/jxa/bridge.js` has its own, lower-level test seam: `test/jxa/` evaluates the real script source against a stubbed JXA `Application` global (see `test/jxa/bridge-harness.ts`), exercising op handlers (`task.list`, `stats`, ...) directly — still no OmniFocus or macOS required.

### Adding a command that needs new OmniFocus data

You must touch all three layers, in this order:
1. Register a handler in `src/jxa/bridge.js` under `ops["domain.action"]`.
2. Add a method to `OmniFocusClient` (types.ts) and implement it in `client.ts` with the matching `op` string.
3. Add the verb file under `src/commands/<noun>/` and wire it into that noun's `index.ts`.

## Conventions & gotchas

- **`src/jxa/bridge.js` is pre-ES6 JXA** — only `var`, `function`, `for` loops. No `let`/`const`, arrow functions, template literals, or destructuring. It is excluded from Biome and TypeScript. Nearly every property read is wrapped in `try/catch` because OmniFocus objects throw when properties are inaccessible; catches return safe defaults. Date parsing is manual (`parseDate`) to avoid JXA timezone ambiguity.
- **Fuzzy entity resolution** is three-tier (exact → case-insensitive substring → ambiguity error with candidates). Ambiguity is returned as an error with candidates, never silently guessed — disambiguation is pushed to the CLI layer.
- **Dual-mode output**: `resolveFormat()` returns `"json"` if `--json` is passed OR stdout is not a TTY, else `"human"` (ANSI-colored). Piped commands auto-switch to JSON — commands just pass the resolved format through.
- **Destructive verbs require `--confirm`** (`task delete`, `project delete`, `tag delete`, `task notification clear`), enforced via `ConfirmationRequiredError`.
- **Duration syntax** (`--offset`, `--repeat`): `[-+]?((\d+h)?(\d+m)?(\d+s)?)`, e.g. `-1h`, `30m`, `1h30m`, `90s`. Parsed by `parseDurationToSeconds`/`parseDurationOrClear`.
- Use `parseIntOption()` for integer options, never `parseInt` directly — Commander's `(value, previous)` parser signature collides with `parseInt(string, radix)`.
- Biome formatting: **tabs**, double quotes, semicolons, 100-col width.

## Documentation

Each `src/` subdirectory carries a `docs.md` ("Noridoc") describing that layer's design. Keep these current when changing a layer — the global instruction to keep docs up to date applies, and the `nori-docs` skill maintains them. The user-facing OmniFocus agent skill that shells out to the `of` binary lives outside this repo (`~/.agents/skills/omnifocus-cli/`).
