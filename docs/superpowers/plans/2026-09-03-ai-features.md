# AI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an injected OpenRouter-backed `AIClient` to the core layer and two task verbs on top of it: `task why` (interactive five-whys session) and `task breakdown` (structured nano-task plan → preview → revise → apply as a subtask tree).

**Architecture:** `src/core/ai/` is a new core module (types, config, prompt loader, context renderer, plan schema/validation, lazy OpenRouter adapter). `buildProgram(client, ai)` threads the AI client through `Register = (parent, client, ai)`. Two new bridge ops (`task.context`, `task.createTree`) gather context and apply a plan in one osascript call each. Interactive input is an entity-agnostic `ui/prompt.ts` primitive.

**Tech Stack:** Bun, TypeScript strict, Commander 13, `@openrouter/sdk` (lazy import), `bun test`, Biome (tabs, double quotes, 100 cols). `src/jxa/bridge.js` is pre-ES6 JXA.

**Spec:** `docs/superpowers/specs/2026-09-03-ai-features-design.md`

## Global Constraints

- Verify with `bun run check && bun run typecheck && bun test` before every commit.
- `src/jxa/bridge.js`: only `var`, `function`, `for`; no `let`/`const`, arrows, template literals, destructuring, spread; every risky property read in `try/catch`.
- Commit messages end with `Claude-Session: https://claude.ai/code/session_01L2voqEC2eEwLsiTxoSnCGD`.
- `--json` is declared on the root only; verbs read it through `runAction`.
- The JSON interface carries zero UI chrome; the AI SDK and `yocto-spinner` are imported lazily, never at module top level.
- Verb `.description()` strings contain no parentheses, colons or semicolons.
- Use `parseIntOption`, never bare `parseInt`.
- JSON output never contains short ids; human output may.
- Never touch the real short-id cache or the real user config dir in tests (`OF_CONFIG_DIR`, `OF_PROMPTS_DIR` test seams).
- Docs updated at the end: README, CLAUDE.md, CHANGELOG, `src/core/docs.md`, `src/core/ai/docs.md` (new), `src/core/ui/docs.md`, `src/commands/docs.md`, `src/jxa/docs.md`, `test/docs.md`, `~/.agents/skills/omnifocus-cli/SKILL.md`.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/core/ai/types.ts` | `Message`, `ChatRequest`, `ChatResult`, `StructuredSchema<T>`, `StructuredResult<T>`, `AIClient`, `AIError` (+ `AIErrorKind`) |
| `src/core/ai/config.ts` | `resolveAIConfig({ model? })`: flag > env > config file > default; `configPath()`; `DEFAULT_MODEL` |
| `src/core/ai/prompts.ts` | `loadPrompt(name)`: user override dir → embedded Markdown |
| `src/core/ai/context.ts` | `renderTaskContext(ctx: TaskContext, today)`: Markdown block for the first user message |
| `src/core/ai/plan.ts` | `PLAN_SCHEMA`, `validatePlan(raw)`, `buildPlanTree(plan)`, `PLAN_STRUCTURED` (schema+validator bundle) |
| `src/core/ai/openrouter.ts` | the only importer of `@openrouter/sdk`; `createOpenRouterClient(config)`; error mapping; `isSdkLoaded()` |
| `src/core/ai/client.ts` | `createAIClient()`: lazy adapter that resolves config + imports the SDK on first call |
| `src/core/ai/conversation.ts` | `Conversation`: message list helper (`system`, `user`, `assistant`, `messages`) |
| `src/core/ui/prompt.ts` | `createPrompter(streams)`: `ask(question)`, `choose(question, keys)`, `close()`; Esc/Ctrl-C/Ctrl-D → `null` |
| `src/core/ui/progress.ts` | + `withSpinner(label, fn, stream?)` (extracted from the proxy) |
| `src/core/output.ts` | + `outputPlanTree(target, tree)`, `outputTreeResult(result)` |
| `src/core/types.ts` | + `TaskContext`, `ContextNode`, `TaskContextOptions`, `PlanTaskInput`, `CreateTreeOptions`, `CreateTreeResult`; `OmniFocusClient.getTaskContext`, `createTaskTree` |
| `src/core/client.ts` | + `getTaskContext`, `createTaskTree` |
| `src/jxa/bridge.js` | + `ops["task.context"]`, `ops["task.createTree"]` |
| `src/prompts/why.md`, `src/prompts/breakdown.md` | system prompts |
| `src/commands/noun.ts` | `Register = (parent, client, ai) => void` |
| `src/program.ts` | `buildProgram(client, ai)` |
| `src/index.ts` | `createAIClient()` |
| `src/commands/task/why.ts`, `breakdown.ts` | the verbs; `task/index.ts` mounts them with aliases `w`, `b` |
| `test/fixtures/fake-ai.ts` | `createFakeAI({ replies })` scripted `AIClient` |
| `test/helpers/run.ts` | `runCommand(setup, argv, client?, ai?)` |
| `test/core/ai/*.test.ts`, `test/core/ui/prompt.test.ts`, `test/integration/ai.test.ts`, `test/jxa/task-context.test.ts`, `test/jxa/task-create-tree.test.ts` | tests |

---

### Task 1: AI types, config and prompt loader

**Files:** create `src/core/ai/types.ts`, `src/core/ai/config.ts`, `src/core/ai/prompts.ts`, `src/prompts/why.md`, `src/prompts/breakdown.md`; tests `test/core/ai/config.test.ts`, `test/core/ai/prompts.test.ts`; `test/preload.ts` sets `OF_CONFIG_DIR` and `OF_PROMPTS_DIR` to temp dirs.

**Produces:**
```ts
export type Role = "system" | "user" | "assistant";
export interface Message { role: Role; content: string }
export interface ChatRequest { messages: Message[]; model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }
export interface ChatResult { content: string; model: string; usage?: { prompt: number; completion: number } }
export interface ValidationFailure { errors: string[] }
export interface StructuredSchema<T> { name: string; schema: Record<string, unknown>; validate(raw: unknown): { value: T } | ValidationFailure }
export interface StructuredResult<T> { value: T; raw: string; model: string; attempts: number }
export interface AIClient { chat(req): Promise<ChatResult>; stream(req, onDelta): Promise<ChatResult>; structured<T>(req, schema): Promise<StructuredResult<T>> }
export type AIErrorKind = "missing-key" | "auth" | "credits" | "rate-limit" | "bad-request" | "invalid-response" | "network" | "aborted";
export class AIError extends CLIError { readonly kind: AIErrorKind }
// config.ts
export interface AIConfig { apiKey: string; model: string; referer: string; title: string }
export function configDir(): string           // $OF_CONFIG_DIR | $XDG_CONFIG_HOME/omnifocus-cli | ~/.config/omnifocus-cli
export function resolveAIConfig(overrides?: { model?: string }): AIConfig   // throws AIError("missing-key")
export function describeAISetup(): string      // help text used by the error
// prompts.ts
export type PromptName = "why" | "breakdown";
export function loadPrompt(name: PromptName): { text: string; source: "override" | "embedded"; path?: string }
```

Tests: precedence (flag > `OF_AI_MODEL` > file > default), key from env vs file, missing key → `AIError` kind `missing-key` mentioning `OPENROUTER_API_KEY` and the config path, malformed config file ignored with no throw; prompt override found in `OF_PROMPTS_DIR`, embedded fallback non-empty, unknown override file ignored.

Commit: `feat(ai): AI client types, config resolution and prompt loader`.

### Task 2: Plan schema, validation and tree building

**Files:** create `src/core/ai/plan.ts`; test `test/core/ai/plan.test.ts`.

**Produces:**
```ts
export interface PlanTask { key: string; parentKey: string | null; name: string; note: string; estimateMinutes: number | null; tags: string[]; flag: boolean; sequential: boolean; due: string | null; defer: string | null }
export interface Plan { summary: string; sequential: boolean; tasks: PlanTask[]; questions: string[] }
export interface PlanNode extends PlanTask { children: PlanNode[] }
export const PLAN_SCHEMA: Record<string, unknown>;
export function validatePlan(raw: unknown): { value: Plan } | ValidationFailure;
export function buildPlanTree(plan: Plan): PlanNode[];
export function countPlanTasks(plan: Plan): number;
export const PLAN_STRUCTURED: StructuredSchema<Plan>;
```
Validation rules from the spec. Tests: valid plan passes; duplicate key, unknown parent, forward parent reference, empty name, non-integer estimate, non-array tags each produce a message naming the key; tree nests two levels correctly and preserves order.

Commit: `feat(ai): breakdown plan schema, validation and tree builder`.

### Task 3: Bridge ops `task.context` and `task.createTree`

**Files:** modify `src/jxa/bridge.js` (after `ops["task.update"]`), `src/core/types.ts`, `src/core/client.ts`, `test/fixtures/mock-client.ts`, `test/fixtures/mock-responses.ts` (+ `MOCK_TASK_CONTEXT`); tests `test/jxa/task-context.test.ts`, `test/jxa/task-create-tree.test.ts`, `test/core/client.test.ts` (op names).

**Produces (types.ts):**
```ts
export interface ContextNode extends OFTask { children: ContextNode[] }
export interface TaskContext { task: OFTask; ancestors: OFTask[]; project: OFProject | null; children: ContextNode[]; siblings: { id: string; name: string; completed: boolean }[]; tags: string[] }
export interface TaskContextOptions { query?: string; id?: string }
export interface PlanTaskInput { key: string; parentKey: string | null; name: string; note?: string; estimate?: number | null; tags?: string[]; flag?: boolean; sequential?: boolean; due?: string | null; defer?: string | null }
export interface CreateTreeOptions { parentId?: string; projectId?: string; sequential?: boolean; tasks: PlanTaskInput[] }
export interface CreateTreeItem { key: string; ok: boolean; id?: string; name: string; error?: string; warnings?: string[] }
export interface CreateTreeResult { parent: { id: string; name: string; project: string }; created: CreateTreeItem[] }
// OmniFocusClient
getTaskContext(opts: TaskContextOptions): Promise<BridgeResponse<TaskContext>>;
createTaskTree(opts: CreateTreeOptions): Promise<BridgeResponse<CreateTreeResult>>;
```
Bridge: `task.context` resolves by `id` (`findTaskById`) or `query` (`findTaskByQuery`), walks `parentTask()` up (max 20), reads `containingProject()` via `formatProject`, recurses `task.tasks()` with a 200-node budget (completed included), siblings via batch `parent.tasks.name()/id()/completed()` (or `project.tasks` / `doc.inboxTasks`), tags via `doc.flattenedTags.name()`. `task.createTree` validates exactly one of `parentId`/`projectId`, applies `sequential` to the parent task, iterates items: resolve container (parent target or `byKey[parentKey]`), skip with error if the ancestor failed, `of.Task({name, note})` pushed into `container.tasks`, `applyTaskProps` with `{estimate, tags, flag, sequential, due, defer}` inside try/catch, record `{key, ok, id, name, warnings}`. Timeout 120s in `client.ts`.

Commit: `feat(bridge): task.context and task.createTree ops`.

### Task 4: UI primitives — prompter and `withSpinner`

**Files:** create `src/core/ui/prompt.ts`; modify `src/core/ui/progress.ts`; tests `test/core/ui/prompt.test.ts`, extend `test/core/ui/progress.test.ts`.

**Produces:**
```ts
export interface PrompterStreams { input?: NodeJS.ReadableStream & { isTTY?: boolean; setRawMode?(m: boolean): unknown }; output?: NodeJS.WritableStream }
export interface Prompter { ask(question: string): Promise<string | null>; choose(question: string, keys: string[]): Promise<string | null>; close(): void }
export function createPrompter(streams?: PrompterStreams): Prompter;
export const QUIT_COMMANDS = ["/quit", "/q", "/exit"];
// progress.ts
export async function withSpinner<T>(label: string, fn: () => Promise<T>, stream?: ProgressStream): Promise<T>;
```
`ask` creates a readline interface per question (`terminal: input.isTTY === true`), listens to a raw `data` chunk equal to `\x1b` (Esc), `SIGINT` (Ctrl-C), `close` (Ctrl-D/EOF); resolves `null` on any of them, trims answers, re-asks on empty input, and maps `QUIT_COMMANDS` to `null`. `choose` accepts the first character of the answer (case-insensitive) if it is in `keys`, otherwise re-asks. `withSpinner` respects the same two gates as `withProgress` (which now calls it).

Tests with `PassThrough` streams: answer line, `/quit`, Esc byte, Ctrl-C, EOF, empty then answer, `choose` invalid then valid.

Commit: `feat(ui): interactive prompter and withSpinner helper`.

### Task 5: OpenRouter adapter and `createAIClient`

**Files:** `package.json` (+ `@openrouter/sdk`), create `src/core/ai/openrouter.ts`, `src/core/ai/client.ts`, `src/core/ai/conversation.ts`; tests `test/core/ai/openrouter.test.ts` (against a `Bun.serve` fake on `127.0.0.1`), `test/core/ai/client.test.ts`.

**Produces:**
```ts
export function createOpenRouterClient(config: AIConfig, opts?: { serverURL?: string }): Promise<AIClient>;
export function isSdkLoaded(): boolean;
export function createAIClient(overrides?: { model?: string }): AIClient;   // lazy; resolves config + SDK on first call
export class Conversation { constructor(system: string); user(text): this; assistant(text): this; get messages(): Message[] }
```
Adapter behaviour: `chat` → `client.chat.send({ model, messages, temperature, max_tokens })`, content extracted from `choices[0].message.content` (string or content-part array); `stream` → `stream: true`, concatenates `choices[0].delta.content`, calls `onDelta`; `structured` → `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`, `provider: { require_parameters: true }`, parses JSON, validates, on failure appends assistant raw + user "fix these problems" and retries once (`attempts` = 2); throws `AIError("invalid-response")` after that. HTTP 401 → `auth`, 402 → `credits`, 429 → `rate-limit`, 400 → `bad-request`, abort → `aborted`, other → `network`.

Fake server tests: request body shape (model, messages, response_format, headers `HTTP-Referer`/`X-Title`, `Authorization`), streaming SSE assembly, 401/402/429 mapping, structured retry then success, structured double failure → `invalid-response`.

Commit: `feat(ai): OpenRouter adapter with chat, streaming and structured output`.

### Task 6: Threading the AI client through the program

**Files:** modify `src/commands/noun.ts`, `src/program.ts`, `src/index.ts`, `test/helpers/run.ts`, `test/helpers/parse.ts` (if it passes a client), create `test/fixtures/fake-ai.ts`; extend `test/integration/program.test.ts`.

**Produces:**
```ts
export type Register = (parent: Command, client: OmniFocusClient, ai: AIClient) => void;
export function buildProgram(client: OmniFocusClient, ai: AIClient): Command;
export function createFakeAI(script?: { replies?: string[]; plans?: unknown[] }): FakeAI;  // FakeAI extends AIClient with `requests: ChatRequest[]`
export function runCommand(setup, argv, client?, ai?): Promise<RunResult>;  // RunResult gains `ai`
```
`createFakeAI` returns queued replies for `chat`/`stream` (calling `onDelta` once with the whole text) and queued plans for `structured` (run through the schema validator so tests exercise real validation); throws `AIError("invalid-response")` when the queue is empty. Program test: after `task list --json`, `isSdkLoaded()` is false.

Commit: `feat(program): inject the AI client alongside the OmniFocus client`.

### Task 7: Context renderer

**Files:** create `src/core/ai/context.ts`; test `test/core/ai/context.test.ts`.

**Produces:** `renderTaskContext(ctx: TaskContext, opts: { today: string; extra?: string }): string` — Markdown with sections: Target task (name, id, note, dates, flag, estimate, tags, sequential, blocked), Ancestors (nearest first), Project (name, status, sequential, counts, due), Existing subtasks (indented tree, `[x]`/`[ ]`, estimates), Siblings (names with `[x]`/`[ ]`, capped at 40 with "… and N more"), Available tags, Additional context from the user. Empty sections say "none". Test: snapshot-free assertions on each section, cap behaviour, `extra` inclusion.

Commit: `feat(ai): render OmniFocus task context for prompts`.

### Task 8: `task breakdown` verb + renderers

**Files:** create `src/commands/task/breakdown.ts`; modify `src/commands/task/index.ts` (mount, alias `b`), `src/core/output.ts` (+ `outputPlanTree`, `outputTreeResult`), `src/core/ui/progress.ts` labels (`getTaskContext: "Gathering task context…"`, `createTaskTree: "Creating subtasks…"`); tests `test/integration/ai.test.ts` (breakdown cases), `test/core/output.test.ts` (tree rendering).

Flow (human): context → `structured` under `withSpinner("Thinking…")` → `outputPlanTree` → `choose("[a]pply, [r]evise or [q]uit", ["a","r","q"])` → loop. JSON: plan only unless `--apply`. Exit 1 if any created item failed. `--context` text appended to the first user message. Conversation: system = `loadPrompt("breakdown")`, user = context + "Break this task down.", assistant = previous plan JSON, user = feedback.

Commit: `feat(task): AI breakdown into nano subtasks with preview, revise and apply`.

### Task 9: `task why` verb

**Files:** create `src/commands/task/why.ts`; modify `src/commands/task/index.ts` (alias `w`); tests in `test/integration/ai.test.ts`.

Flow: refuse when not interactive (`isInteractive(process.stdin)`/stdout or format json) with `CLIError`; optional ref → context; conversation system = `loadPrompt("why")`; first user message = context + "Start the session with your first question."; loop: `stream` assistant text to stdout (prefixed line), `ask("> ")`, `null` → break; print `dim("Session ended.")`. `AbortController` per stream call, aborted on Ctrl-C via the prompter's SIGINT path (a `process.once("SIGINT")` while streaming).

Commit: `feat(task): AI five-whys session for avoided tasks`.

### Task 10: Completion parity, docs, changelog

**Files:** README (new "AI features" section + command reference rows), CLAUDE.md, CHANGELOG (Unreleased), `src/core/ai/docs.md` (new Noridoc), `src/core/docs.md`, `src/core/ui/docs.md`, `src/commands/docs.md`, `src/jxa/docs.md`, `test/docs.md`, `~/.agents/skills/omnifocus-cli/SKILL.md`.

Verify `test/integration/completion.test.ts` still passes (new verbs are picked up automatically). Commit: `docs: AI features`.
