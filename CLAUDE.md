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

Presentation sits beside that pipeline, not inside it: `src/core/output.ts` is the entity renderer (task/project/tag formatting, JSON/error/warning emitters) and `src/core/ui/` is the entity-agnostic terminal toolkit (`colors.ts` ANSI primitives, `terminal.ts` interactivity detection, `progress.ts` spinner decorator). In `src/index.ts` the real client is wrapped as `withProgress(createClient())` before `buildProgram`, so every bridge round-trip gets a stderr spinner in human mode without any command knowing.

- **Program assembly** (`src/program.ts`): `buildProgram(client)` assembles the Commander program (version comes from package.json — never hardcode it elsewhere). It also installs the `preAction` hook that calls `setProgressEnabled(resolveFormat(json) === "human")`, the single switch that allows UI chrome for the current invocation. `src/index.ts` is the thin executable entry: create client → buildProgram → parseAsync with global error handling. Tests import `buildProgram`, never `index.ts` (which parses argv at import time).
- **CLI layer** (`src/commands/`): Thin wrappers — parse args → call client → format output → catch errors. Nothing imports from `commands/`; it only imports from `src/core/`. Organized noun-verb: each noun (task, project, tag, folder, inbox, bulk) is a directory with an `index.ts` registering verb files. Standalone commands (forecast, review, stats, collect, completion) attach to the root program. **Nouns are declared, not hand-registered.** Each `src/commands/<noun>/index.ts` is a `defineNoun({ name, alias, description, verbs })` literal (`src/commands/noun.ts`); aliases are one stable letter (`t p g f i b`), verbs never get aliases, and the root gets no verb shortcuts. Every verb wraps its handler in `runAction()` and declares shared flags through the option groups in `src/commands/options/` (`taskRefArgument`, `taskCreateOptions`/`taskEditOptions`, `listQueryOptions`, `limitOption`, `confirmOption` + `requireConfirm`). A verb file contains only what is specific to that verb; if a flag or argument is needed by two verbs it belongs in `options/`. Shell completions are generated from the live Commander tree (`generateCompletionScript`), not hardcoded — a parity test enforces coverage.
- **Client layer** (`src/core/client.ts`): `createClient()` returns an `OmniFocusClient`. Each method builds a `BridgeCommand { op, params }` (e.g. `"task.create"`, `"task.notification.add"`, `"forecast"`) and calls `executeBridge()`. Timeouts scale by op weight: 30s default, 60s for forecast/review/stats, 120s for bulk.
- **Bridge/transport** (`src/core/bridge.ts` + `src/jxa/bridge.js`): JSON command in, JSON response out. Response is always `{ ok: true, data }` or `{ ok: false, error, candidates? }`. `unwrapBridgeResponse()` turns `{ ok: false }` into a thrown `BridgeError` (preserving disambiguation candidates), mapping known environment failures (Apple Events permission -1743, app not found) to actionable messages via `matchKnownBridgeFailure()`. Timeout/empty/malformed responses surface as `JXAExecutionError`. Command JSON over 128KB is piped through child stdin with the `@stdin` sentinel argument (ARG_MAX safety); `executeBridge` throws a clear error on non-macOS platforms. The osascript binary is resolved per-call from `OF_BRIDGE_BIN` (test seam; defaults to `/usr/bin/osascript`).

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
- **Dual-mode output**: `resolveFormat()` returns `"json"` if `--json` is passed OR stdout is not a TTY, else `"human"` (ANSI-colored). Piped commands auto-switch to JSON — commands just pass the resolved format through. stderr has the same contract: piped stderr gets one JSON object per line (`{"ok":false,"error":...,"candidates":?}` / `{"warning":...}`), a terminal gets human text. Colors honor `NO_COLOR`/`FORCE_COLOR` and per-stream TTY detection — pass `CLIError` objects to `outputError` (not pre-formatted strings) so candidates stay structured.
- **The JSON interface is for agents and must carry zero UI chrome.** Progress is off by default and only enabled by the `preAction` hook when the format is human; `withProgress` additionally requires `isInteractive(stderr)` (TTY, not `CI`, not `TERM=dumb`). Any UI library (today `yocto-spinner`) must be imported lazily inside the code path that draws, never at module top level, so a `--json` run never evaluates it. `test/integration/program.test.ts` guards this — extend it when adding UI features.
- **UI primitives live in `src/core/ui/`, renderers in `src/core/output.ts`.** Commands import color helpers (`bold`, `dim`, `red`, ...) from `core/ui/colors.js` and entity formatters from `core/output.js`; `output.ts` no longer re-exports colors. Named color helpers take an optional target stream (`red("✗", process.stderr)`) so stderr decoration follows stderr's own TTY state. Future tables/boxes belong in `ui/` as entity-agnostic primitives, consumed by `output.ts`.
- **Destructive verbs require `--confirm`** (`task delete`, `project delete`, `tag delete`, `task notification clear`, `inbox process --delete`, `inbox process-many` with any `delete: true` item), enforced via `ConfirmationRequiredError`.
- **Duration syntax** (`--offset`, `--repeat`): `[-+]?((\d+h)?(\d+m)?(\d+s)?)`, e.g. `-1h`, `30m`, `1h30m`, `90s`. Explicit zeros (`0s`) are valid — a due-relative offset of 0 fires at the due time; empty/sign-only strings are rejected. Parsed by `parseDurationToSeconds`/`parseDurationOrClear`.
- **Stdin-reading commands** (bulk add/update/complete, inbox process-many) must use `readJsonArray(example, itemLabel, validate?)` from `src/core/stdin.ts` — it fails fast with a usage example when stdin is a TTY instead of hanging.
- **`task complete` is variadic.** `of t complete 42 43 "Call mom"` completes each reference through the single-task `task.complete` op (one round-trip each, full fuzzy/candidate/"already completed" semantics). One reference keeps the old contract (bare object in JSON, error + exit 1); several references emit an array of `{ ref, ok, ... }` results and exit 1 if any failed. `--id` is rejected with more than one reference.
- **Dates are resolved by OmniFocus itself.** `resolveDate()` in the bridge sends anything that is not an exact ISO form (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`) to OmniFocus's own parser via Omni Automation (`Formatter.Date` + the app's `DefaultDueTime`/`DefaultStartTime`/`DefaultPlannedTime` settings), so `--due tomorrow`, `fri 5pm`, `2d`, `10.9.` work everywhere dates are accepted. ISO forms keep byte-identical local parsing (a bare ISO date stays at midnight) so scripts never change behavior. `setDateProp()` reads every date back after writing and throws when OmniFocus did not store it — never report a date change you have not verified. `of task move <ref> [due] [--defer] [--planned]` (`src/commands/task/move.ts`) is a thin verb over `task.update`; with `--id` a sole positional is the date.
- **`--json` is a root option only.** Never declare it on a verb — Commander recognises it after the subcommand and `runAction` reads it via `optsWithGlobals()`.
- **One creator.** `task add` handles inbox tasks, project tasks (`--project`) and subtasks (`--parent`/`--parent-id`); `inbox add` mounts the same register function. The bridge's `createTaskRecord()` is shared by `task.create` and `bulk.create`.
- **Short-id aliases are human-mode only.** `src/core/short-ids.ts` caches a small persistent `OmniFocus id → number` map so `of task list` output like `42  Buy milk` can be referenced later as `of task complete 42`. Resolution happens entirely in the TS layer via `resolveTaskRef()` (an all-digit positional matching a cached alias resolves to the real id before the bridge ever sees it) — the bridge and its ops know nothing about aliases. JSON/piped output must never surface a short id, only the real OmniFocus id. Tests must never touch the real cache file: `bunfig.toml` + `test/preload.ts` redirect `OF_SHORT_ID_CACHE` to a temp directory for every test run, so this doesn't need to be handled per-test.
- Test helpers that mutate process state (`withEnv`, `withStreamTTY`) live in `test/helpers/env.ts` — reuse them rather than re-implementing save/restore per file. `withEnv` is promise-aware.
- Use `parseIntOption()` for integer options, never `parseInt` directly — Commander's `(value, previous)` parser signature collides with `parseInt(string, radix)`.
- Biome formatting: **tabs**, double quotes, semicolons, 100-col width.

## Documentation

Each `src/` subdirectory carries a `docs.md` ("Noridoc") describing that layer's design. Keep these current when changing a layer — the global instruction to keep docs up to date applies, and the `nori-docs` skill maintains them. The user-facing OmniFocus agent skill that shells out to the `of` binary lives outside this repo (`~/.agents/skills/omnifocus-cli/`).
