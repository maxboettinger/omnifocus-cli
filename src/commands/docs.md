# Noridoc: commands

Path: @/src/commands

### Overview
- CLI layer that parses user input and dispatches to `@/src/core/client.ts`. Commands are thin wrappers: parse args → call client → format output → handle errors.
- Organized as a noun-verb hierarchy: `of <noun> <verb> [args] [options]`. Each noun (task, project, tag, folder, inbox, bulk) is a directory with a Commander subcommand; verbs are individual files within it.
- A handful of standalone commands (forecast, review, stats, collect, completion) register directly on the root program without a noun grouping.

### How it fits into the larger codebase
- This is the outermost layer of the application — nothing imports from `commands/`; it only imports from `@/src/core/`.
- `@/src/index.ts` creates the Commander `program`, calls `createClient()`, then passes both into every `register*Commands()` function exported from this directory.
- Each verb file depends on `OmniFocusClient` (from `@/src/core/types.ts`) for all OmniFocus operations, `unwrapBridgeResponse()` (from `@/src/core/client.ts`) to extract data from bridge results, `BridgeError` (from `@/src/core/errors.ts`) for error handling, and output helpers (from `@/src/core/output.ts`) for formatting.
- Commands never talk to the JXA bridge or OmniFocus directly — the client is the sole interface.

### Core Implementation
- **Registration pattern**: Each noun directory has an `index.ts` that creates a Commander subcommand (`program.command("task")`) and calls verb-level `register*Command(cmd, client)` functions to attach verbs under it. Standalone commands attach directly to the root program.
- **Verb file contract**: Every verb file exports a single `registerXxxCommand(parent: Command, client: OmniFocusClient): void`. Inside, it uses Commander's fluent API (`.command()`, `.argument()`, `.option()`, `.action()`) to define the CLI surface, then delegates to the client in the async action handler.
- **Dependency injection**: `OmniFocusClient` is created once in `@/src/index.ts` and threaded through registration. Commands are decoupled from client construction.
- **Output format**: Most commands accept `--json` and use `resolveFormat()` to choose between human-readable formatting (`outputTaskDetail`, `formatTaskLine`, etc.) and raw JSON via `outputJson()`.
- **Error handling**: Verb actions wrap their body in try/catch, catching `BridgeError` specifically and falling through to `outputError()` for user-facing messages.

### Things to Know
- Verb files within a noun directory use short, non-prefixed names (`add.ts`, `list.ts`) since the noun context is already established by the parent subcommand. This means identically-named files exist across noun directories — the noun directory provides disambiguation.
- The `completion` command is the only registration function that does not receive a `client` parameter, since shell completion generation has no OmniFocus interaction.
- `bulk` commands accept structured JSON input (arrays of tasks/updates) for batch operations, which is a different input pattern from the single-entity noun commands.
- The `forecast` command is the most complex standalone command — it categorizes and renders tasks across multiple days with colored terminal output, rather than simple list/detail formatting.

Created and maintained by Nori.
