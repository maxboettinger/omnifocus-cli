# AI features — design

Date: 2026-09-03
Status: design decided autonomously (user asked for brainstorm → plan → implement in one pass); implementation follows the plan in `docs/superpowers/plans/2026-09-03-ai-features.md`.

## Goal

Make `of` AI-capable in a way that is "AI first": one LLM client (OpenRouter) that
lives in the core layer, is injected like the OmniFocus client, and can be used from any
verb. Ship two features on top of it:

1. **`of task why [ref]`** — an interactive "five whys" coaching session that drills into
   why a task (or anything) is being avoided. Turn by turn, adaptive, ends only when the
   user quits (Esc / Ctrl-C / Ctrl-D / `/quit`).
2. **`of task breakdown <ref>`** — break a task into granular, single-step, AuDHD-friendly
   nano tasks using structured output, preview them, revise with feedback as often as
   wanted, then apply them to OmniFocus as a nested subtask tree in one bridge operation.

Prompts are plain Markdown files in one folder, loaded at runtime and overridable per user.

## Non-goals

- A general chat REPL (`of ai chat`), inbox triage, or other AI verbs. The architecture
  makes them cheap to add later; they are not part of this change.
- Provider abstraction beyond OpenRouter. OpenRouter is itself the multi-provider layer.
- Persisting `why` transcripts into OmniFocus. Deliberately left out of v1 (see Open
  follow-ups) so the session stays a zero-side-effect conversation.
- Streaming for the structured breakdown call (a JSON blob is not readable mid-stream).

## Research summary

- **OpenRouter SDK** (verified against `@openrouter/sdk@1.2.100`, 2026-09-03): official,
  Speakeasy-generated, ESM-only, sole runtime dependency `zod`; Bun ≥ 1 is a supported
  runtime; adds ~0.7 MB to the compiled binary. `new OpenRouter({ apiKey, httpReferer,
  appTitle, serverURL? })`; `client.chat.send({ chatRequest: { model, messages,
  temperature, maxCompletionTokens, responseFormat: { type: "json_schema", jsonSchema:
  { name, strict, schema } }, provider: { requireParameters: true }, stream } },
  { signal })`. Non-streaming result: `choices[0].message.content` (string or content
  parts), `model`, `usage.promptTokens/completionTokens`. Streaming result is an
  `EventStream` async iterable of chunks with `choices[0].delta.content`. Errors are
  typed classes extending `OpenRouterError` with `statusCode` (401/402/429/400 …) plus
  `RequestAbortedError`/`ConnectionError` for transport failures. Attribution headers
  are `HTTP-Referer` and `X-OpenRouter-Title`. `openrouter/auto`, `:nitro`/`:floor`
  suffixes and a `models: []` fallback list are supported. `anthropic/claude-sonnet-4`
  does not advertise structured outputs; `openai/gpt-4.1-mini`, `google/gemini-2.5-flash`
  and `anthropic/claude-sonnet-5` do. Default model: `google/gemini-2.5-flash` (fast,
  cheap, strict schema support); overridable everywhere.
- **Config precedence** in mature AI CLIs (`llm`, `aichat`, `mods`, `fabric`, `sgpt`):
  flag > env var > config file > built-in default; keys in env or a config file under
  `$XDG_CONFIG_HOME/<tool>/`; prompts ("patterns", "roles", "templates") as plain text
  files in one directory with user-local overrides.
- **Preview → apply**: terraform-style plan/apply; agents get a JSON plan on stdout and an
  explicit `--apply` flag; humans get a rendered preview and a confirm/revise/quit prompt.
- **Structured output**: strict JSON-schema mode is widely supported through OpenRouter,
  but recursive `$ref` schemas are not portable across providers. A flat list with
  `parentKey` references is portable and trivially validated, so the tree is flattened in
  the schema and rebuilt in TypeScript.
- **Esc in Bun**: verified by spike — Bun's `readline.emitKeypressEvents` never flushes a
  lone `ESC` (no `escapeCodeTimeout`), so Esc is detected from a raw one-byte `\x1b` chunk
  on stdin; readline's `SIGINT` event covers Ctrl-C and `close` covers Ctrl-D.

## Decisions (with rationale)

1. **AI is a core service, injected like OmniFocus.** `src/core/ai/` exposes an
   `AIClient` interface (`types.ts`) and `createAIClient()`; `src/index.ts` passes it to
   `buildProgram(client, ai)`, and `Register` becomes `(parent, client, ai)`. Verbs that
   don't use AI ignore the third argument. Tests inject `createFakeAI()` exactly as they
   inject the mock OmniFocus client. This is the "AI first" requirement: any verb, today
   or later, gets the LLM without wiring.
2. **The SDK is wrapped and lazily imported.** `AIClient` is our narrow interface
   (`chat`, `stream`, `structured`); the SDK lives only in `src/core/ai/openrouter.ts` and
   is `await import()`ed on first use, so `task list --json` and every non-AI run never
   evaluate it (same rule as `yocto-spinner`). `test/integration/program.test.ts` guards
   this.
3. **Verbs live under `task`.** `task breakdown|b <ref>` and `task why|w [ref]` — both act
   on a task, so they follow the noun-verb rule instead of an `ai` noun. Letters `b`/`w`
   are free in the `task` noun.
4. **Prompts are Markdown files in `src/prompts/`,** one per feature (`why.md`,
   `breakdown.md`), embedded with a Bun text import (so the compiled binary carries them,
   and `bun run dev` reads the file fresh every run) and overridable at runtime by
   `$OF_PROMPTS_DIR/<name>.md` or `~/.config/omnifocus-cli/prompts/<name>.md`. The
   loader is `src/core/ai/prompts.ts`. No templating: dynamic context is sent as the
   first user message, not spliced into the system prompt.
5. **Config precedence: flag > env > config file > default.** `--model` on the verb;
   `OPENROUTER_API_KEY`, `OF_AI_MODEL`; `$XDG_CONFIG_HOME/omnifocus-cli/config.json`
   (`{ "ai": { "apiKey"?, "model"? } }`); default model constant in `config.ts`. A
   missing key throws an `AIError` with setup instructions before any network call.
6. **Structured output uses a flat plan schema.** `PlanSchema` items carry
   `key`/`parentKey`; validation (`plan.ts`) checks the tree (keys unique, parent defined
   earlier, no cycles) and rebuilds it. On a validation failure `structured()` retries
   once, feeding the errors back to the model; a second failure is an `AIError`.
7. **Apply is one bridge op.** New `task.createTree` op creates the whole subtree in a
   single osascript call (parents before children, per-item soft failures, warnings
   preserved, the target's `sequential` flag applied), instead of N round-trips from
   TypeScript. New `task.context` op gathers everything the prompt needs (task, ancestor
   chain, project, full existing subtree incl. completed, siblings, all tag names) in one
   call.
8. **Interactive means interactive.** Both verbs require an interactive stdin+stdout
   in human mode; `why` refuses to run non-interactively. `breakdown` has a
   non-interactive contract for agents: `--json` prints the plan and applies nothing;
   `--json --apply` applies and prints the result. `--context "<text>"` adds free-form
   user context to the request in any mode.
9. **UI primitives stay entity-agnostic.** The line/keypress prompter (`ui/prompt.ts`)
   and the spinner helper (`withSpinner`, extracted from `progress.ts`) go in
   `src/core/ui/`; the tree renderer for plans goes in `src/core/output.ts`.

## Architecture

```
src/commands/task/why.ts, breakdown.ts     (verbs; need both clients)
        │
        ├── src/core/ai/context.ts   OmniFocus data → Markdown context block
        ├── src/core/ai/plan.ts      PLAN_SCHEMA, validatePlan(), buildTree()
        ├── src/core/ai/prompts.ts   loadPrompt(name) with user override
        ├── src/core/ai/config.ts    resolveAIConfig({ model? })
        ├── src/core/ai/types.ts     AIClient, ChatRequest, Message, AIError kinds
        ├── src/core/ai/client.ts    createAIClient() → lazy OpenRouter adapter
        └── src/core/ai/openrouter.ts  the only file importing @openrouter/sdk
src/core/ui/prompt.ts     ask()/choose() with Esc/Ctrl-C/Ctrl-D → null
src/core/ui/progress.ts   + withSpinner(label, fn)
src/core/output.ts        + outputPlanTree(), outputTreeResult()
src/jxa/bridge.js         + ops["task.context"], ops["task.createTree"]
src/prompts/why.md, breakdown.md
```

### `AIClient`

```ts
interface Message { role: "system" | "user" | "assistant"; content: string }
interface ChatRequest {
  messages: Message[];          // system prompt is messages[0]
  model?: string;               // resolved by config when absent
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}
interface ChatResult { content: string; model: string; usage?: { prompt: number; completion: number } }
interface AIClient {
  chat(req: ChatRequest): Promise<ChatResult>;
  stream(req: ChatRequest, onDelta: (text: string) => void): Promise<ChatResult>;
  structured<T>(req: ChatRequest, schema: StructuredSchema<T>): Promise<StructuredResult<T>>;
}
interface StructuredSchema<T> { name: string; schema: Record<string, unknown>; validate(raw: unknown): T | ValidationFailure }
```

`AIError extends CLIError` with `kind: "missing-key" | "auth" | "credits" | "rate-limit" | "bad-request" | "invalid-response" | "network"`, mapped from SDK errors in `openrouter.ts`.

### Plan schema (structured output)

```jsonc
{
  "summary": "one sentence on the approach",
  "sequential": true,                // how the target's children should be ordered
  "tasks": [
    {
      "key": "1", "parentKey": null, // parentKey refers to an earlier item's key
      "name": "Open the tax portal in the browser",
      "note": "…or empty string",
      "estimateMinutes": 5,          // or null
      "tags": ["@computer"],         // only names from the provided tag list
      "flag": false,
      "sequential": false,           // ordering of this item's own children
      "due": null, "defer": null     // OmniFocus-parseable text or null
    }
  ],
  "questions": ["anything the model wants the user to clarify"]
}
```

All properties are required (strict mode), nullable where optional. Validation rules:
`tasks` non-empty, keys unique and non-empty, `parentKey` null or an earlier key, names
non-empty and ≤ 200 chars, `estimateMinutes` null or integer ≥ 1.

### Bridge ops

- `task.context { query?, id? }` → `{ task: OFTask, ancestors: OFTask[], project: OFProject | null, children: ContextNode[], siblings: { id, name, completed }[], tags: string[] }` where `ContextNode = OFTask & { children: ContextNode[] }` (completed children included, subtree capped at 200 nodes). Siblings and tags use batch reads.
- `task.createTree { parentId?, projectId?, sequential?, tasks: PlanTask[] }` → `{ parent: { id, name }, created: [{ key, ok, id?, name, error?, warnings? }] }`. Items are created in array order under `parentId`/`projectId` (or under the item named by `parentKey`); a failed item is recorded and its descendants are skipped with an error naming the failed ancestor. Exactly one of `parentId`/`projectId` is required.

### Command contracts

**`of task why [ref] [--model <id>] [--context <text>]`**
- Human/interactive only. Non-interactive → `CLIError("task why is an interactive session; run it in a terminal")`, exit 1.
- With a ref: `task.context` is fetched and rendered into the first user message; without: the first user message says there is no specific task.
- Loop: assistant turn is streamed to stdout; the user answers on one line; Esc / Ctrl-C / Ctrl-D / `/quit` / `/q` ends the session. Empty answers are ignored (re-prompt).
- The full history (system + every turn) is sent each time. Temperature 0.7.

**`of task breakdown <ref> [--context <text>] [--model <id>] [--apply] [--json]`**
- Fetch `task.context`, build the request, call `structured()` with `PLAN_SCHEMA`.
- Human mode: render the tree preview; prompt `[a]pply · [r]evise · [q]uit`. `r` asks for
  a feedback line, appends `{assistant: <plan JSON>}` and `{user: <feedback>}` to the
  conversation and re-runs `structured()`, then re-renders. `a` applies via
  `task.createTree` and prints the result tree with per-item ✓/✗ and warnings; exits 1 if
  any item failed. `q` exits 0 with nothing changed. `--apply` skips the prompt.
- JSON mode: prints `{ target: { id, name, project }, plan, applied: null }` and exits 0
  without applying; with `--apply` it applies and prints `applied: { parent, created }`
  (exit 1 if any item failed). Revision is not available in JSON mode (agents can re-run
  with a richer `--context`).
- Temperature 0.2.

### Error handling

- Missing key / bad key / no credits / rate limit → `AIError` with a one-line fix hint
  (env var name, config path, model id). All go through `outputError` (JSON line when
  piped).
- Bridge failures (task not found, ambiguous) behave exactly like other task verbs.
- A quit at any prompt never leaves partial state: creation only happens inside one
  `task.createTree` call; per-item failures inside it are reported, not hidden.
- Ctrl-C during a streaming response aborts the request via `AbortSignal` and ends the
  session cleanly.

### Testing

- `test/fixtures/fake-ai.ts`: scripted `AIClient` (queue of text/plan responses,
  records every request) — the AI counterpart of `createMockClient()`.
- `test/core/ai/`: config precedence; prompt loading + override; plan validation +
  tree building (cycles, unknown parents, order); context rendering; `openrouter.ts`
  error mapping and request shaping against a local `Bun.serve` fake endpoint (real SDK,
  no network).
- `test/core/ui/prompt.test.ts`: lines, `/quit`, raw Esc byte, Ctrl-C, Ctrl-D, EOF.
- `test/integration/ai.test.ts`: `breakdown --json` (plan only, no client mutation),
  `--json --apply`, human revise → apply loop with scripted stdin, `why` non-interactive
  refusal, `why` scripted session ending on Esc.
- `test/jxa/task-context.test.ts`, `test/jxa/task-create-tree.test.ts`.
- `test/integration/program.test.ts`: AI SDK module not loaded for non-AI commands.

## Open follow-ups (not in this change)

- `task why --save` to append a session summary to the task note.
- `project breakdown` (the bridge op already accepts `projectId`).
- Per-prompt front matter (model/temperature per prompt file).
