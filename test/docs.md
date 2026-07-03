# Noridoc: test

Path: @/test

### Overview
- Test suite for omnifocus-cli using `bun:test`, covering unit tests for core modules, integration tests for CLI command wiring, and direct tests of the JXA bridge script's op handlers.
- All tests run without OmniFocus.app or macOS Apple Events. Command-level tests do this via a fully mocked `OmniFocusClient`; the JXA-level tests in `test/jxa/` do it by evaluating the real bridge script against a stubbed `Application` global.
- Shared fixtures in `test/fixtures/` provide canonical mock domain objects (`OFTask`, `OFProject`, `StatsResult`) and helpers for wrapping them in `BridgeResponse` envelopes.

### How it fits into the larger codebase
- Unit tests in `test/core/` import directly from `@/src/core/` — specifically the error class hierarchy, `unwrapBridgeResponse`, output formatters, and domain types.
- Integration tests in `test/integration/` import the `register*Commands` functions from `@/src/commands/` and the `OmniFocusClient` interface from `@/src/core/types.js`, wiring real Commander programs to mock clients.
- For CLI/client/output code, the boundary under test stops at `OmniFocusClient`: bridge transport (`@/src/core/bridge.ts`) and OmniFocus Apple Events are not exercised there — the client interface is the seam for that layer.
- Tests in `test/jxa/` exercise `@/src/jxa/bridge.js` directly, below the `OmniFocusClient` seam, using the harness described below.
- Fixtures mirror the exact shapes returned by `@/src/core/bridge.ts`, so tests validate that upstream code handles real response envelopes correctly.

### Core Implementation
- **Mocking strategy**: `createMockClient()` in the integration tests builds a complete `OmniFocusClient` where every method is a `bun:test` `mock()` returning a `Promise<BridgeResponse<T>>` via the `successResponse()` helper. Tests assert on call counts and argument shapes.
- **Integration test harness**: `runCommand()` creates a real `Commander` program with `exitOverride()`, registers a single command group, monkey-patches `console.log`/`console.error` to capture output arrays, then calls `parseAsync()`. This tests the full path from CLI argv through option parsing, command handler, client call, and output formatting.
- **Unit test coverage**: core tests verify `unwrapBridgeResponse` success/error unwrapping (including structured candidates), the full `CLIError` hierarchy (exit codes, `format()`, specialized subclasses), parser helpers (integer and duration syntax), and output formatters (`formatTaskLine`, `formatTaskDetail`, `formatProjectLine`, `formatProjectDetail`, `resolveFormat`).
- **Fixture design**: `mock-responses.ts` exports typed constants (`MOCK_TASK`, `MOCK_PROJECT`, `MOCK_STATS`) plus `successResponse<T>()` and `errorResponse()` factory functions that wrap data in `BridgeResponse` envelopes. `MOCK_TASK` includes notification sample data for task notification command and detail output coverage. The `makeTask()`/`makeProject()` helpers in output tests use spread overrides for targeted field variations.
- **JXA bridge harness** (`test/jxa/bridge-harness.ts`): reads and evaluates the real `@/src/jxa/bridge.js` source (shebang stripped, since it's invalid syntax for `new Function`) with a stubbed `Application` global, then dispatches a single `{ op, params }` command via the script's `run()` entry point — exercising real op handlers (`task.list`, `stats`, etc.) with no mocking of bridge logic itself. `makeElementArray`/`makeJxaObject` reproduce JXA's callable-specifier shape: an element array (e.g. `doc.inboxTasks`) is both callable (returns the element objects) and has batch property getters (`.completed()` returns an array of values) — required because the bridge's batch-property-access code paths call properties directly on the array-like specifier, not per-element.

### Things to Know
- The integration tests rely on `exitOverride()` to prevent Commander from calling `process.exit()` on parse errors. Without it, a bad test would kill the runner.
- Console capture via monkey-patching (`console.log = ...`) is restored in a `finally` block. Tests that check TTY-dependent behavior (`isTTY`) use `Object.defineProperty` to temporarily override `process.stdout.isTTY` and restore it afterward.
- The `test/commands/` and `test/services/` directories exist but are currently empty — all command-level testing lives in `test/integration/cli.test.ts` as a single integration file rather than per-command test files.
- Coverage still excludes bridge transport (`@/src/core/bridge.ts`, the `osascript` spawn itself), forecast output, review output, and bulk operation formatting — these still require real OmniFocus interaction or more elaborate mocking. The JXA script (`@/src/jxa/bridge.js`) is no longer excluded: `test/jxa/` covers its op handlers directly via the harness above.
- Integration coverage includes `task notification list|add|update|delete|clear`, plus validation guards (`--confirm`, kind-specific requirements, required mutation flags).
- Integration coverage also includes the stderr limit notice (asserting it's absent from stdout's JSON and present in captured stderr lines when a list result fills its `--limit`) and that `inbox list`'s `--newest-first` flag and 50-item default limit are passed through to the client unchanged. `test/jxa/task-list.test.ts` covers the corresponding bridge-side behavior — that `newestFirst` sorts the inbox by creation date before `limit` is applied, using the harness's `makeElementArray` to stub batch `creationDate()` reads.

Created and maintained by Nori.
