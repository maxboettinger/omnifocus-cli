# Noridoc: test

Path: @/test

### Overview
- Test suite for omnifocus-cli using `bun:test`, covering unit tests for core modules and integration tests for CLI command wiring.
- All tests run without OmniFocus.app — the `OmniFocusClient` interface is fully mocked, so the suite exercises parsing, formatting, error handling, and command dispatch in isolation.
- Shared fixtures in `test/fixtures/` provide canonical mock domain objects (`OFTask`, `OFProject`, `StatsResult`) and helpers for wrapping them in `BridgeResponse` envelopes.

### How it fits into the larger codebase
- Unit tests in `test/core/` import directly from `@/src/core/` — specifically the error class hierarchy, `unwrapBridgeResponse`, output formatters, and domain types.
- Integration tests in `test/integration/` import the `register*Commands` functions from `@/src/commands/` and the `OmniFocusClient` interface from `@/src/core/types.js`, wiring real Commander programs to mock clients.
- The boundary under test stops at `OmniFocusClient`: nothing below it (bridge transport, JXA execution, OmniFocus Apple Events) is exercised. This is intentional — the client interface is the seam.
- Fixtures mirror the exact shapes returned by `@/src/core/bridge.ts`, so tests validate that upstream code handles real response envelopes correctly.

### Core Implementation
- **Mocking strategy**: `createMockClient()` in the integration tests builds a complete `OmniFocusClient` where every method is a `bun:test` `mock()` returning a `Promise<BridgeResponse<T>>` via the `successResponse()` helper. Tests assert on call counts and argument shapes.
- **Integration test harness**: `runCommand()` creates a real `Commander` program with `exitOverride()`, registers a single command group, monkey-patches `console.log`/`console.error` to capture output arrays, then calls `parseAsync()`. This tests the full path from CLI argv through option parsing, command handler, client call, and output formatting.
- **Unit test coverage**: core tests verify `unwrapBridgeResponse` success/error unwrapping (including structured candidates), the full `CLIError` hierarchy (exit codes, `format()`, specialized subclasses), parser helpers (integer and duration syntax), and output formatters (`formatTaskLine`, `formatTaskDetail`, `formatProjectLine`, `formatProjectDetail`, `resolveFormat`).
- **Fixture design**: `mock-responses.ts` exports typed constants (`MOCK_TASK`, `MOCK_PROJECT`, `MOCK_STATS`) plus `successResponse<T>()` and `errorResponse()` factory functions that wrap data in `BridgeResponse` envelopes. `MOCK_TASK` includes notification sample data for task notification command and detail output coverage. The `makeTask()`/`makeProject()` helpers in output tests use spread overrides for targeted field variations.

### Things to Know
- The integration tests rely on `exitOverride()` to prevent Commander from calling `process.exit()` on parse errors. Without it, a bad test would kill the runner.
- Console capture via monkey-patching (`console.log = ...`) is restored in a `finally` block. Tests that check TTY-dependent behavior (`isTTY`) use `Object.defineProperty` to temporarily override `process.stdout.isTTY` and restore it afterward.
- The `test/commands/` and `test/services/` directories exist but are currently empty — all command-level testing lives in `test/integration/cli.test.ts` as a single integration file rather than per-command test files.
- Coverage deliberately excludes: bridge transport (`@/src/core/bridge.ts`), the JXA script (`@/src/jxa/bridge.js`), forecast output, review output, and bulk operation formatting. These would require either real OmniFocus interaction or more complex JXA mocking.
- Integration coverage includes `task notification list|add|update|delete|clear`, plus validation guards (`--confirm`, kind-specific requirements, required mutation flags).

Created and maintained by Nori.
