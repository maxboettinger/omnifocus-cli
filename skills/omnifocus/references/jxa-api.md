# JXA API Reference (Legacy)

Direct JXA script guidance is deprecated for agent behavior in this project.

Use the CLI contract instead:
- commands: `src/commands/`
- client bridge contract: `src/core/types.ts` and `src/core/client.ts`
- architecture overview: `docs.md`

Current bridge internals include an Omni Automation path for task notifications (`task.notification.*`) via `evaluate javascript`.

JXA implementation details are internal bridge concerns and should not be treated as the primary automation interface for skills.
