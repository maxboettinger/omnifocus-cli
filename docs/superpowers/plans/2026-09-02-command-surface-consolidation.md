# Command Surface Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `of` a pure noun-verb CLI with one-letter noun aliases, remove the root task shortcuts, fold overlapping verbs, and ensure every command, option group, argument, parser, output helper and test harness is defined exactly once.

**Architecture:** The CLI layer (`src/commands/`) keeps its verb-file contract (`registerXxxCommand(parent, client)`), but every verb is built from shared pieces: `runAction()` (the one action wrapper), `defineNoun()` (the one noun registrar), option groups under `src/commands/options/` with paired readers, and shared helpers in `src/core/` (`parsers.ts`, `stdin.ts`, `output.ts`). The bridge gains `parent`/`parentId` on `task.create` (shared with `bulk.create` through one `createTaskRecord()` helper) so `task.subtask` and `inbox.add` can be deleted.

**Tech Stack:** Bun runtime, TypeScript (strict), Commander 13, Biome (tabs, double quotes, 100 cols), `bun test`. `src/jxa/bridge.js` is pre-ES6 JXA (`var`, `function`, `for` only).

**Spec:** `docs/superpowers/specs/2026-09-02-command-surface-consolidation-design.md`

## Global Constraints

- Verify with `bun run check && bun run typecheck && bun test` after every task; all three must be green before each commit.
- `src/jxa/bridge.js`: only `var`, `function`, `for`. No `let`/`const`, arrows, template literals, destructuring, spread.
- Commit messages end with the line `Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X`.
- Noun aliases: exactly `task|t`, `project|p`, `tag|g`, `folder|f`, `inbox|i`, `bulk|b`. Verbs never get aliases. The root gets no verb shortcuts.
- Task reference positionals are named `ref`/`refs` everywhere; projects `project`, tags `tag`, folders `folder`.
- The per-verb `--json` option is removed everywhere; only the root program declares it. Commander recognises root options after a subcommand by default, and `runAction` reads `cmd.optsWithGlobals().json`.
- JSON output shapes and stderr JSON lines of surviving commands do not change.
- Verb `.description()` strings must not contain parentheses, colons or semicolons (completion generator constraint).
- Use `parseIntOption`/`parseIntOrClear` for integers, never bare `parseInt`.
- Never touch the real short-id cache; `bunfig.toml` + `test/preload.ts` already redirect it.
- Docs: each `src/*/docs.md` (Noridoc) must be updated in the final docs task via the `updating-noridocs` skill; README, CLAUDE.md, `test/docs.md` and `~/.agents/skills/omnifocus-cli/SKILL.md` too.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/core/parsers.ts` | + `collectRepeatable`, `parseIntOrClear` |
| `src/core/stdin.ts` | + `readJsonArray()` |
| `src/core/output.ts` | + `outputWarnings`, `outputEntityAction`, `outputBatchSummary`, `BatchItem`, `BatchSummary` |
| `src/commands/noun.ts` | NEW — `Register`, `NounSpec`, `defineNoun()` |
| `src/commands/options/common.ts` | NEW — `confirmOption`, `requireConfirm`, `limitOption`, `listQueryOptions`, `readListQuery` |
| `src/commands/options/refs.ts` | NEW — `taskRefArgument`, `readTaskRef`, `projectRefArgument` |
| `src/commands/options/task-fields.ts` | NEW — `taskDateOptions`, `readTaskDates`, `taskCreateOptions`, `readTaskCreate`, `taskEditOptions`, `readTaskEdits` |
| `src/commands/<noun>/index.ts` | one `defineNoun({...})` literal each |
| `src/commands/<noun>/<verb>.ts` | verb-specific code only, built on `runAction` + groups |
| `src/commands/shortcuts.ts` | DELETED |
| `src/commands/task/subtask.ts` | DELETED (folded into `task add --parent`) |
| `src/commands/bulk/create.ts` | RENAMED to `src/commands/bulk/add.ts` |
| `src/commands/completion.ts` | alias-aware tree + generators |
| `src/program.ts` | no shortcuts |
| `src/jxa/bridge.js` | `createTaskRecord()` shared by `task.create`/`bulk.create`; `task.subtask`, `inbox.add` removed |
| `src/core/types.ts`, `src/core/client.ts` | `TaskCreateOptions` + parent; `createSubtask`, `addInbox`, `SubtaskCreateOptions` removed |
| `test/helpers/run.ts` | the single CLI harness (+ root `--json`, `runCommandWithStdin`) |
| `test/helpers/env.ts` | + `withStdin()` |
| `test/helpers/parse.ts` | NEW — `parseCommand()` for option-group tests |
| `test/jxa/bridge-harness.ts` | + `Task`/`InboxTask`/`RepetitionRule` constructors |

---

### Task 1: Shared parsers

**Files:**
- Modify: `src/core/parsers.ts`
- Test: `test/core/parsers.test.ts`

**Interfaces:**
- Produces: `collectRepeatable(value: string, previous: string[]): string[]`, `parseIntOrClear(value: string): number | "clear"`.

- [ ] **Step 1: Write the failing tests** — append to `test/core/parsers.test.ts` (extend the existing import line to include the two new names):

```ts
import {
	collectRepeatable,
	parseDurationOrClear,
	parseDurationToSeconds,
	parseIntOrClear,
} from "../../src/core/parsers.js";

describe("collectRepeatable", () => {
	test("appends each value without mutating the previous array", () => {
		const first = collectRepeatable("a", []);
		const second = collectRepeatable("b", first);
		expect(first).toEqual(["a"]);
		expect(second).toEqual(["a", "b"]);
	});
});

describe("parseIntOrClear", () => {
	test("passes 'clear' through and parses integers", () => {
		expect(parseIntOrClear("clear")).toBe("clear");
		expect(parseIntOrClear("30")).toBe(30);
	});

	test("rejects non-numbers", () => {
		expect(() => parseIntOrClear("abc")).toThrow("Invalid number: abc");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/core/parsers.test.ts`
Expected: FAIL — `collectRepeatable`/`parseIntOrClear` are not exported.

- [ ] **Step 3: Implement** — append to `src/core/parsers.ts`:

```ts
/** Commander repeatable-option accumulator: `--tag a --tag b` → ["a", "b"]. */
export function collectRepeatable(value: string, previous: string[]): string[] {
	return [...previous, value];
}

/** Integer option that also accepts the literal `clear` (used to remove a value). */
export function parseIntOrClear(value: string): number | "clear" {
	if (value === "clear") return "clear";
	return parseIntOption(value);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/core/parsers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/parsers.ts test/core/parsers.test.ts
git commit -m "feat(parsers): shared collectRepeatable and parseIntOrClear

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 2: Option-group test helper and `options/common.ts`

**Files:**
- Create: `test/helpers/parse.ts`
- Create: `src/commands/options/common.ts`
- Test: `test/commands/options/common.test.ts`

**Interfaces:**
- Produces (test helper): `parseCommand(setup: (cmd: Command) => void, argv: string[]): { args: unknown[]; opts: Record<string, unknown> }`.
- Produces: `confirmOption(cmd, help?)`, `requireConfirm(opts, action)`, `limitOption(cmd, defaultLimit?)`, `listQueryOptions(cmd, labels)`, `readListQuery(opts)`, types `ListQueryLabels`, `ListQuery`.

- [ ] **Step 1: Write the test helper** — `test/helpers/parse.ts`:

```ts
/**
 * Parse argv through a throwaway Commander command and capture what the
 * action received. Used by option-group tests so each group is exercised
 * through Commander's real parser rather than by inspecting internals.
 */

import { Command } from "commander";

export interface ParsedInvocation {
	args: unknown[];
	opts: Record<string, unknown>;
}

export function parseCommand(setup: (cmd: Command) => void, argv: string[]): ParsedInvocation {
	let captured: ParsedInvocation = { args: [], opts: {} };
	const cmd = new Command().exitOverride();
	setup(cmd);
	cmd.action((...actionArgs: unknown[]) => {
		actionArgs.pop(); // the Command itself
		const opts = actionArgs.pop() as Record<string, unknown>;
		captured = { args: actionArgs, opts };
	});
	cmd.parse(argv, { from: "user" });
	return captured;
}
```

- [ ] **Step 2: Write the failing tests** — `test/commands/options/common.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
	confirmOption,
	limitOption,
	listQueryOptions,
	readListQuery,
	requireConfirm,
} from "../../../src/commands/options/common.js";
import { ConfirmationRequiredError } from "../../../src/core/errors.js";
import { parseCommand } from "../../helpers/parse.js";

describe("confirmOption / requireConfirm", () => {
	test("throws ConfirmationRequiredError naming the action when --confirm is absent", () => {
		const { opts } = parseCommand((cmd) => confirmOption(cmd), []);
		expect(() => requireConfirm(opts, "task delete")).toThrow(ConfirmationRequiredError);
		expect(() => requireConfirm(opts, "task delete")).toThrow(
			"task delete requires --confirm flag for safety",
		);
	});

	test("passes when --confirm is given", () => {
		const { opts } = parseCommand((cmd) => confirmOption(cmd), ["--confirm"]);
		expect(() => requireConfirm(opts, "task delete")).not.toThrow();
	});
});

describe("limitOption", () => {
	test("parses --limit as an integer and applies the default", () => {
		expect(parseCommand((cmd) => limitOption(cmd, 20), []).opts.limit).toBe(20);
		expect(parseCommand((cmd) => limitOption(cmd, 20), ["--limit", "5"]).opts.limit).toBe(5);
		expect(parseCommand((cmd) => limitOption(cmd), []).opts.limit).toBeUndefined();
	});
});

describe("listQueryOptions", () => {
	test("declares --search, --count, --limit and optionally --active-only", () => {
		const { opts } = parseCommand(
			(cmd) => listQueryOptions(cmd, { count: "Include counts", activeOnly: "Only active" }),
			["--search", "x", "--count", "--active-only", "--limit", "3"],
		);
		expect(readListQuery(opts)).toEqual({ search: "x", count: true, activeOnly: true, limit: 3 });
	});

	test("omits --active-only when no label is given", () => {
		expect(() =>
			parseCommand((cmd) => listQueryOptions(cmd, { count: "c" }), ["--active-only"]),
		).toThrow();
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `bun test test/commands/options/common.test.ts`
Expected: FAIL — module `src/commands/options/common.js` not found.

- [ ] **Step 4: Implement** — `src/commands/options/common.ts`:

```ts
/**
 * Option groups shared across nouns. Each `xxxOption(s)` declares flags on a
 * Commander command and returns it; each `readXxx` maps the parsed opts to
 * client parameters so verbs never repeat the flag → param mapping.
 */

import type { Command } from "commander";
import { ConfirmationRequiredError } from "../../core/errors.js";
import { parseIntOption } from "../../core/parsers.js";

export function confirmOption(
	cmd: Command,
	help = "Confirm the destructive action, required for safety",
): Command {
	return cmd.option("--confirm", help);
}

/** Throw the standard confirmation error unless `--confirm` was passed. */
export function requireConfirm(opts: Record<string, unknown>, action: string): void {
	if (!opts.confirm) throw new ConfirmationRequiredError(action);
}

export function limitOption(cmd: Command, defaultLimit?: number): Command {
	const help = "Maximum number of results";
	return defaultLimit === undefined
		? cmd.option("--limit <n>", help, parseIntOption)
		: cmd.option("--limit <n>", help, parseIntOption, defaultLimit);
}

export interface ListQueryLabels {
	/** Help text for `--count`, e.g. "Include task counts". */
	count: string;
	/** Help text for `--active-only`; the flag is omitted when undefined. */
	activeOnly?: string;
}

export function listQueryOptions(cmd: Command, labels: ListQueryLabels): Command {
	cmd.option("--search <query>", "Filter by name").option("--count", labels.count);
	if (labels.activeOnly) cmd.option("--active-only", labels.activeOnly);
	return limitOption(cmd);
}

export interface ListQuery {
	search?: string;
	count?: boolean;
	activeOnly?: boolean;
	limit?: number;
}

export function readListQuery(opts: Record<string, unknown>): ListQuery {
	return {
		search: opts.search as string | undefined,
		count: opts.count as boolean | undefined,
		activeOnly: opts.activeOnly as boolean | undefined,
		limit: opts.limit as number | undefined,
	};
}
```

- [ ] **Step 5: Run to verify pass**

Run: `bun test test/commands/options/common.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add test/helpers/parse.ts src/commands/options/common.ts test/commands/options/common.test.ts
git commit -m "feat(commands): shared confirm, limit and list-query option groups

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 3: `options/refs.ts`

**Files:**
- Create: `src/commands/options/refs.ts`
- Test: `test/commands/options/refs.test.ts`

**Interfaces:**
- Consumes: `resolveTaskRef(ref, explicitId)` from `src/core/short-ids.ts` returning `TaskRef { query?: string; id?: string }`.
- Produces: `type RefShape = "optional" | "required" | "variadic"`, `taskRefArgument(cmd, shape?)`, `readTaskRef(ref, opts): TaskRef`, `projectRefArgument(cmd, shape?)`.

- [ ] **Step 1: Write the failing tests** — `test/commands/options/refs.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
	projectRefArgument,
	readTaskRef,
	taskRefArgument,
} from "../../../src/commands/options/refs.js";
import { parseCommand } from "../../helpers/parse.js";

describe("taskRefArgument", () => {
	test("optional shape accepts no ref and an --id", () => {
		const { args, opts } = parseCommand((cmd) => taskRefArgument(cmd), ["--id", "abc"]);
		expect(args).toEqual([undefined]);
		expect(readTaskRef(args[0] as string | undefined, opts)).toEqual({ query: undefined, id: "abc" });
	});

	test("required shape rejects a missing ref", () => {
		expect(() => parseCommand((cmd) => taskRefArgument(cmd, "required"), [])).toThrow();
	});

	test("variadic shape collects every ref", () => {
		const { args } = parseCommand((cmd) => taskRefArgument(cmd, "variadic"), ["1", "Call mom"]);
		expect(args).toEqual([["1", "Call mom"]]);
	});

	test("a non-numeric ref passes through as a query", () => {
		const { args, opts } = parseCommand((cmd) => taskRefArgument(cmd), ["Buy milk"]);
		expect(readTaskRef(args[0] as string, opts)).toEqual({ query: "Buy milk" });
	});
});

describe("projectRefArgument", () => {
	test("required by default, with --id", () => {
		const { args, opts } = parseCommand((cmd) => projectRefArgument(cmd), ["Home", "--id", "p1"]);
		expect(args).toEqual(["Home"]);
		expect(opts.id).toBe("p1");
	});

	test("optional shape allows omitting the project", () => {
		const { args } = parseCommand((cmd) => projectRefArgument(cmd, "optional"), ["--id", "p1"]);
		expect(args).toEqual([undefined]);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/commands/options/refs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/commands/options/refs.ts`:

```ts
/**
 * Entity-reference arguments. A task is referenced by `<ref>` — a short id
 * from a human listing, a name query, or a raw OmniFocus id — plus an
 * explicit `--id`. Projects take `<project>` + `--id`. Declaring them here
 * keeps every verb's wording and resolution identical.
 */

import type { Command } from "commander";
import { resolveTaskRef, type TaskRef } from "../../core/short-ids.js";

export type RefShape = "optional" | "required" | "variadic";

const TASK_REF_HELP = "Task reference: short id, name or OmniFocus id";

export function taskRefArgument(cmd: Command, shape: RefShape = "optional"): Command {
	switch (shape) {
		case "required":
			return cmd.argument("<ref>", TASK_REF_HELP).option("--id <id>", "Task ID");
		case "variadic":
			return cmd
				.argument("[refs...]", `${TASK_REF_HELP}s, omit with --id`)
				.option("--id <id>", "Task ID, single task only");
		default:
			return cmd
				.argument("[ref]", `${TASK_REF_HELP}, omit with --id`)
				.option("--id <id>", "Task ID");
	}
}

/** Resolve a task positional plus the parsed `--id` into the client's `{ query, id }`. */
export function readTaskRef(ref: string | undefined, opts: Record<string, unknown>): TaskRef {
	return resolveTaskRef(ref, opts.id as string | undefined);
}

export function projectRefArgument(
	cmd: Command,
	shape: Exclude<RefShape, "variadic"> = "required",
): Command {
	const help = "Project name or search query";
	return (
		shape === "required"
			? cmd.argument("<project>", help)
			: cmd.argument("[project]", `${help}, omit with --id`)
	).option("--id <id>", "Project ID");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/commands/options/refs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/options/refs.ts test/commands/options/refs.test.ts
git commit -m "feat(commands): shared task and project reference arguments

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 4: Bridge `task.create` gains parent support, shared with `bulk.create`

**Files:**
- Modify: `src/jxa/bridge.js` (`ops["task.create"]` at ~598, `ops["bulk.create"]`)
- Modify: `test/jxa/bridge-harness.ts` (`app` object in `runBridgeArgs`)
- Modify: `src/core/types.ts` (`TaskCreateOptions`, `createTask` return type)
- Test: `test/jxa/task-create.test.ts`

**Interfaces:**
- Produces (bridge): `task.create` params gain `parent` (query) and `parentId`; response gains `parent: { id, name, project }` when a parent was used. `bulk.create` items accept the same fields.
- Produces (types): `TaskCreateOptions.parent?: string; parentId?: string`; `createTask` resolves with `{ id, name, task, parent?, changes?, warnings? }`.

- [ ] **Step 1: Extend the JXA harness** — in `test/jxa/bridge-harness.ts`, inside `runBridgeArgs`, add constructors to `app` (before `includeStandardAdditions`):

```ts
	let created = 0;
	// OmniFocus constructors: `of.Task({...})`, `of.InboxTask({...})`. Each
	// returns a mutable object with a fresh id so ops that create records can
	// be exercised without a real document.
	const construct = (props: Record<string, unknown>) =>
		makeMutableJxaObject({ id: `new-${++created}`, completed: false, flagged: false, ...props });
	const app = {
		Task: construct,
		InboxTask: construct,
		RepetitionRule: (props: Record<string, unknown>) => props,
		includeStandardAdditions: false,
		// ...existing fields unchanged
```

- [ ] **Step 2: Write the failing tests** — `test/jxa/task-create.test.ts`:

```ts
/**
 * ops["task.create"] — one op for inbox tasks, project tasks and subtasks.
 * `parent`/`parentId` nest the new task under an existing task; without a
 * project or parent the task lands in the inbox. bulk.create shares the
 * same record builder, so a parent is honoured there too.
 */

import { describe, expect, test } from "bun:test";
import { runBridge } from "./bridge-harness.js";

function parentTask(id: string, name: string, pushed: unknown[]) {
	return {
		id: () => id,
		name: () => name,
		tasks: { push: (t: unknown) => pushed.push(t) },
		containingProject: () => ({ name: () => "Errands" }),
	};
}

function docWithParent(pushed: unknown[], inbox: unknown[]) {
	const parent = parentTask("p1", "Parent", pushed);
	return {
		flattenedTasks: {
			byId: (id: string) => {
				if (id !== "p1") throw new Error("not found");
				return parent;
			},
		},
		flattenedProjects: () => [],
		inboxTasks: { push: (t: unknown) => inbox.push(t) },
	};
}

describe("task.create", () => {
	test("without project or parent creates an inbox task", () => {
		const inbox: unknown[] = [];
		const response = runBridge(docWithParent([], inbox), "task.create", { name: "Loose" });
		expect(response.ok).toBe(true);
		expect(inbox.length).toBe(1);
		expect((response.data as { parent?: unknown }).parent).toBeUndefined();
	});

	test("with parentId nests under the parent and reports it", () => {
		const pushed: unknown[] = [];
		const response = runBridge(docWithParent(pushed, []), "task.create", {
			name: "Child",
			parentId: "p1",
		});
		expect(response.ok).toBe(true);
		const data = response.data as { name: string; parent: { id: string; name: string; project: string } };
		expect(data.name).toBe("Child");
		expect(data.parent).toEqual({ id: "p1", name: "Parent", project: "Errands" });
		expect(pushed.length).toBe(1);
	});

	test("unknown parentId fails", () => {
		const response = runBridge(docWithParent([], []), "task.create", { name: "x", parentId: "nope" });
		expect(response.ok).toBe(false);
		expect(response.error).toBe("Parent task not found by ID: nope");
	});

	test("project and parent together are rejected", () => {
		const response = runBridge(docWithParent([], []), "task.create", {
			name: "x",
			project: "P",
			parentId: "p1",
		});
		expect(response.ok).toBe(false);
		expect(response.error).toBe("Use either project or parent, not both");
	});

	test("missing name fails", () => {
		const response = runBridge(docWithParent([], []), "task.create", {});
		expect(response.ok).toBe(false);
		expect(response.error).toBe("Task name required");
	});
});

describe("bulk.create", () => {
	test("honours parentId per item through the shared record builder", () => {
		const pushed: unknown[] = [];
		const response = runBridge(docWithParent(pushed, []), "bulk.create", {
			tasks: [{ name: "A", parentId: "p1" }, { name: "" }],
		});
		expect(response.ok).toBe(true);
		const results = response.data as Array<{ ok: boolean; error?: string; parent?: { id: string } }>;
		expect(results[0]?.ok).toBe(true);
		expect(results[0]?.parent?.id).toBe("p1");
		expect(results[1]).toEqual({ ok: false, error: "Task name required", name: "" });
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `bun test test/jxa/task-create.test.ts`
Expected: FAIL — `parent` undefined / `of.Task is not a function` before the harness change, "Use either project or parent" not produced.

- [ ] **Step 4: Implement in `src/jxa/bridge.js`** — replace `ops["task.create"]` with a shared builder plus a thin op, and make `bulk.create` use it:

```js
// Build one task from a parameter bag. Shared by task.create and bulk.create.
// Returns { data } on success or { error, candidates } on failure.
function createTaskRecord(of, doc, p) {
    if (!p.name) return { error: "Task name required" };
    if (p.project && (p.parent || p.parentId)) return { error: "Use either project or parent, not both" };
    var parentTask = null, project = null;
    if (p.parentId) {
        parentTask = findTaskById(doc, p.parentId);
        if (!parentTask) return { error: "Parent task not found by ID: " + p.parentId };
    } else if (p.parent) {
        var r = findTaskByQuery(doc, p.parent);
        if (r.error) return { error: r.error, candidates: r.candidates };
        parentTask = r.task;
    } else if (p.project) {
        var pl = findExistingProject(doc, p.project);
        if (pl.error) return { error: pl.error, candidates: pl.candidates };
        project = pl.project;
    }
    var tp = { name: p.name }; if (p.note) tp.note = p.note;
    var task;
    if (parentTask) { task = of.Task(tp); parentTask.tasks.push(task); }
    else if (project) { task = of.Task(tp); project.tasks.push(task); }
    else { task = of.InboxTask(tp); doc.inboxTasks.push(task); }
    var changes = applyTaskProps(of, doc, task, p);
    var data = { id: task.id(), name: task.name(), task: formatTask(task), changes: changes, warnings: extractWarnings(changes) };
    if (parentTask) {
        var pp = null; try { var ppp = parentTask.containingProject(); if (ppp) pp = ppp.name(); } catch(e) {}
        data.parent = { id: parentTask.id(), name: parentTask.name(), project: pp || "Inbox" };
    }
    return { data: data };
}

ops["task.create"] = function(of, doc, p) {
    var r = createTaskRecord(of, doc, p);
    if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
    return ok(r.data);
};
```

and

```js
ops["bulk.create"] = function(of, doc, p) {
    if (!p.tasks || !Array.isArray(p.tasks)) return fail("tasks array required");
    if (p.tasks.length > 100) return fail("Bulk create limited to 100 per batch");
    var results = [];
    for (var i = 0; i < p.tasks.length; i++) {
        var input = p.tasks[i];
        try {
            var r = createTaskRecord(of, doc, input);
            if (r.error) { results.push({ ok: false, error: r.error, name: input.name }); continue; }
            var item = r.data; item.ok = true;
            results.push(item);
        } catch(e) { results.push({ ok: false, error: e.message, name: input.name }); }
    }
    return ok(results);
};
```

If `formatTask(task)` throws on the harness's mutable object, wrap only the failing property reads inside `formatTask` in `try/catch` returning `null`, matching the file's existing convention — do not special-case the harness.

- [ ] **Step 5: Extend the types** — in `src/core/types.ts`:

```ts
export interface TaskCreateOptions {
	name: string;
	note?: string;
	due?: string;
	defer?: string;
	planned?: string;
	tags?: string[];
	flag?: boolean;
	estimate?: number;
	/** Create inside this project. Mutually exclusive with parent/parentId. */
	project?: string;
	/** Create as a subtask of this task (short id, name or OmniFocus id). */
	parent?: string;
	/** Create as a subtask of this task id. */
	parentId?: string;
	sequential?: boolean;
	repeat?: string;
	repeatMethod?: string;
}
```

and in `OmniFocusClient.createTask`'s resolved type add `parent?: { id: string; name: string; project: string };` next to `task: OFTask;`.

- [ ] **Step 6: Run to verify pass**

Run: `bun test test/jxa/ && bun run typecheck`
Expected: PASS (existing JXA tests unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/jxa/bridge.js src/core/types.ts test/jxa/bridge-harness.ts test/jxa/task-create.test.ts
git commit -m "feat(bridge): task.create accepts parent, shared record builder with bulk.create

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 5: `options/task-fields.ts`

**Files:**
- Create: `src/commands/options/task-fields.ts`
- Test: `test/commands/options/task-fields.test.ts`

**Interfaces:**
- Consumes: `collectRepeatable`, `parseIntOption`, `parseIntOrClear` (Task 1); `resolveTaskRef`; `DateField` from `src/core/output.ts`; `TaskCreateOptions` (Task 4), `TaskUpdateOptions`.
- Produces: `taskDateOptions(cmd, { fields?, clearable? })`, `readTaskDates(opts)`, `taskCreateOptions(cmd)`, `readTaskCreate(name, opts): TaskCreateOptions`, `taskEditOptions(cmd)`, `readTaskEdits(opts): TaskEdits`, `type TaskEdits = Omit<TaskUpdateOptions, "id" | "query" | "complete" | "incomplete">`.

- [ ] **Step 1: Write the failing tests** — `test/commands/options/task-fields.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
	readTaskCreate,
	readTaskDates,
	readTaskEdits,
	taskCreateOptions,
	taskDateOptions,
	taskEditOptions,
} from "../../../src/commands/options/task-fields.js";
import { parseCommand } from "../../helpers/parse.js";

describe("taskDateOptions", () => {
	test("declares all three dates by default", () => {
		const { opts } = parseCommand((cmd) => taskDateOptions(cmd), [
			"--due", "tomorrow", "--defer", "mon", "--planned", "thu",
		]);
		expect(readTaskDates(opts)).toEqual({ due: "tomorrow", defer: "mon", planned: "thu" });
	});

	test("restricts to the requested fields", () => {
		expect(() =>
			parseCommand((cmd) => taskDateOptions(cmd, { fields: ["defer", "planned"] }), ["--due", "x"]),
		).toThrow();
	});

	test("clearable mode documents 'clear' in the help text", () => {
		const { opts } = parseCommand((cmd) => taskDateOptions(cmd, { clearable: true }), ["--due", "clear"]);
		expect(readTaskDates(opts).due).toBe("clear");
	});
});

describe("taskCreateOptions / readTaskCreate", () => {
	test("maps every create flag onto TaskCreateOptions", () => {
		const { opts } = parseCommand((cmd) => taskCreateOptions(cmd), [
			"--note", "n", "--due", "2026-03-05", "--tag", "a", "--tag", "b", "--flag",
			"--estimate", "30", "--project", "P", "--sequential", "--repeat", "FREQ=DAILY",
			"--repeat-method", "fixed",
		]);
		expect(readTaskCreate("Buy milk", opts)).toEqual({
			name: "Buy milk",
			note: "n",
			due: "2026-03-05",
			defer: undefined,
			planned: undefined,
			tags: ["a", "b"],
			flag: true,
			estimate: 30,
			project: "P",
			parent: undefined,
			parentId: undefined,
			sequential: true,
			repeat: "FREQ=DAILY",
			repeatMethod: "fixed",
		});
	});

	test("--parent-id wins and --parent passes through as a query", () => {
		const byId = parseCommand((cmd) => taskCreateOptions(cmd), ["--parent-id", "abc"]).opts;
		expect(readTaskCreate("x", byId)).toMatchObject({ parent: undefined, parentId: "abc" });
		const byName = parseCommand((cmd) => taskCreateOptions(cmd), ["--parent", "Groceries"]).opts;
		expect(readTaskCreate("x", byName)).toMatchObject({ parent: "Groceries", parentId: undefined });
	});
});

describe("taskEditOptions / readTaskEdits", () => {
	test("maps every edit flag, including clear values", () => {
		const { opts } = parseCommand((cmd) => taskEditOptions(cmd), [
			"--name", "New", "--note-append", "more", "--due", "clear", "--estimate", "clear",
			"--tag", "t", "--remove-tag", "u", "--unflag", "--parallel", "--project", "P",
			"--repeat", "clear",
		]);
		expect(readTaskEdits(opts)).toEqual({
			name: "New",
			note: undefined,
			noteAppend: "more",
			due: "clear",
			defer: undefined,
			planned: undefined,
			flag: undefined,
			unflag: true,
			estimate: "clear",
			tags: ["t"],
			removeTags: ["u"],
			project: "P",
			sequential: undefined,
			parallel: true,
			repeat: "clear",
			repeatMethod: undefined,
		});
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/commands/options/task-fields.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/commands/options/task-fields.ts`:

```ts
/**
 * Task field option groups — the single declaration of the flags that
 * describe a task (dates, note, tags, flag, estimate, container, repeat)
 * for creating and for editing, plus readers that map parsed opts onto the
 * client's parameter types. Consumers: task add (also mounted as inbox add),
 * task update, task move, inbox process.
 */

import type { Command } from "commander";
import type { DateField } from "../../core/output.js";
import { collectRepeatable, parseIntOption, parseIntOrClear } from "../../core/parsers.js";
import { resolveTaskRef } from "../../core/short-ids.js";
import type { TaskCreateOptions, TaskUpdateOptions } from "../../core/types.js";

const ALL_DATE_FIELDS: readonly DateField[] = ["due", "defer", "planned"];
const DATE_LABEL: Record<DateField, string> = {
	due: "Due date",
	defer: "Defer date",
	planned: "Planned date",
};

export interface TaskDateOptionsConfig {
	/** Which of due/defer/planned to declare. Default: all three. */
	fields?: readonly DateField[];
	/** Mention that `clear` removes the date. Default: false. */
	clearable?: boolean;
}

export function taskDateOptions(cmd: Command, config: TaskDateOptionsConfig = {}): Command {
	const { fields = ALL_DATE_FIELDS, clearable = false } = config;
	for (const field of fields) {
		const help = clearable ? `${DATE_LABEL[field]}, or clear to remove` : DATE_LABEL[field];
		cmd.option(`--${field} <date>`, help);
	}
	return cmd;
}

export type TaskDates = Pick<TaskUpdateOptions, DateField>;

export function readTaskDates(opts: Record<string, unknown>): TaskDates {
	return {
		due: opts.due as string | undefined,
		defer: opts.defer as string | undefined,
		planned: opts.planned as string | undefined,
	};
}

export function taskCreateOptions(cmd: Command): Command {
	taskDateOptions(cmd);
	return cmd
		.option("--note <text>", "Task note")
		.option("--tag <name>", "Apply tag, repeatable", collectRepeatable, [])
		.option("--flag", "Flag the task")
		.option("--estimate <minutes>", "Estimated minutes", parseIntOption)
		.option("--project <name>", "Create inside this project")
		.option("--parent <ref>", "Create as a subtask of this task, short id, name or OmniFocus id")
		.option("--parent-id <id>", "Create as a subtask of this task ID")
		.option("--sequential", "Make the task sequential")
		.option("--repeat <rrule>", "Repetition rule")
		.option("--repeat-method <method>", "Repetition method");
}

export function readTaskCreate(name: string, opts: Record<string, unknown>): TaskCreateOptions {
	const parentRef = resolveTaskRef(
		opts.parent as string | undefined,
		opts.parentId as string | undefined,
	);
	return {
		name,
		note: opts.note as string | undefined,
		...readTaskDates(opts),
		tags: opts.tag as string[],
		flag: opts.flag as boolean | undefined,
		estimate: opts.estimate as number | undefined,
		project: opts.project as string | undefined,
		parent: parentRef.id ? undefined : parentRef.query,
		parentId: parentRef.id,
		sequential: opts.sequential as boolean | undefined,
		repeat: opts.repeat as string | undefined,
		repeatMethod: opts.repeatMethod as string | undefined,
	};
}

export function taskEditOptions(cmd: Command): Command {
	taskDateOptions(cmd, { clearable: true });
	return cmd
		.option("--name <name>", "New name")
		.option("--note <text>", "Replace the note")
		.option("--note-append <text>", "Append to the note")
		.option("--tag <name>", "Apply tag, repeatable", collectRepeatable, [])
		.option("--remove-tag <name>", "Remove tag, repeatable", collectRepeatable, [])
		.option("--flag", "Flag the task")
		.option("--unflag", "Remove the flag")
		.option("--estimate <minutes>", "Estimated minutes, or clear to remove", parseIntOrClear)
		.option("--project <name>", "Move to this project")
		.option("--sequential", "Make sequential")
		.option("--parallel", "Make parallel")
		.option("--repeat <rrule>", "Repetition rule, or clear to remove")
		.option("--repeat-method <method>", "Repetition method");
}

export type TaskEdits = Omit<TaskUpdateOptions, "id" | "query" | "complete" | "incomplete">;

export function readTaskEdits(opts: Record<string, unknown>): TaskEdits {
	return {
		name: opts.name as string | undefined,
		note: opts.note as string | undefined,
		noteAppend: opts.noteAppend as string | undefined,
		...readTaskDates(opts),
		flag: opts.flag as boolean | undefined,
		unflag: opts.unflag as boolean | undefined,
		estimate: opts.estimate as number | "clear" | undefined,
		tags: opts.tag as string[],
		removeTags: opts.removeTag as string[],
		project: opts.project as string | undefined,
		sequential: opts.sequential as boolean | undefined,
		parallel: opts.parallel as boolean | undefined,
		repeat: opts.repeat as string | undefined,
		repeatMethod: opts.repeatMethod as string | undefined,
	};
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/commands/options/ && bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/options/task-fields.ts test/commands/options/task-fields.test.ts
git commit -m "feat(commands): single declaration of task field option groups

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 6: Output helpers `outputWarnings`, `outputEntityAction`, `outputBatchSummary`

**Files:**
- Modify: `src/core/output.ts`
- Test: `test/core/output.test.ts`

**Interfaces:**
- Produces: `outputWarnings(warnings?: string[]): void`, `outputEntityAction(action: string, name: string, id?: string): void`, `interface BatchItem { ok: boolean; id?: string; name?: string; error?: string; changes?: string[]; warnings?: string[] }`, `interface BatchSummary { succeeded: number; failed: number; partial: number }`, `outputBatchSummary(title: string, results: readonly BatchItem[]): BatchSummary`.

- [ ] **Step 1: Write the failing tests** — append to `test/core/output.test.ts` (add the new names to its existing import from `../../src/core/output.js`; reuse the file's existing console capture pattern if it has one, otherwise use this local capture):

```ts
function capture(fn: () => void): { out: string[]; err: string[] } {
	const out: string[] = [];
	const err: string[] = [];
	const origLog = console.log;
	const origErr = console.error;
	console.log = (...a: unknown[]) => {
		out.push(a.map(String).join(" "));
	};
	console.error = (...a: unknown[]) => {
		err.push(a.map(String).join(" "));
	};
	try {
		fn();
	} finally {
		console.log = origLog;
		console.error = origErr;
	}
	return { out, err };
}

describe("outputWarnings", () => {
	test("prints one partial-apply warning per entry and nothing for empty input", () => {
		expect(capture(() => outputWarnings(undefined)).err).toEqual([]);
		expect(capture(() => outputWarnings([])).err).toEqual([]);
		const { err } = capture(() => outputWarnings(["tag X not found"]));
		expect(err.join("\n")).toContain("Partial apply warning: tag X not found");
	});
});

describe("outputEntityAction", () => {
	test("capitalises the action and appends an existing short id", () => {
		const { out } = capture(() => outputEntityAction("deleted", "Buy milk"));
		expect(out).toEqual(["✓ Deleted: Buy milk"]);
	});
});

describe("outputBatchSummary", () => {
	test("reports counts, lists successes with changes and warnings, and failures", () => {
		let summary: BatchSummary | undefined;
		const { out, err } = capture(() => {
			summary = outputBatchSummary("Bulk update completed", [
				{ ok: true, id: "1", name: "A", changes: ["due: x"], warnings: ["w"] },
				{ ok: true, id: "2", name: "B" },
				{ ok: false, id: "3", error: "boom" },
			]);
		});
		expect(summary).toEqual({ succeeded: 2, failed: 1, partial: 1 });
		const text = out.join("\n");
		expect(text).toContain("Bulk update completed: 2 succeeded, 1 failed");
		expect(text).toContain("A (1)");
		expect(text).toContain("• due: x");
		expect(text).toContain("3: boom");
		expect(text).toContain("Total: 3 items");
		expect(err.join("\n")).toContain("A: w");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/core/output.test.ts`
Expected: FAIL — names not exported.

- [ ] **Step 3: Implement** — add to `src/core/output.ts` after `outputLimitNotice`:

```ts
/** Report the bridge's soft `warnings` (best-effort property application). */
export function outputWarnings(warnings?: string[]): void {
	for (const warning of warnings ?? []) outputWarning(`Partial apply warning: ${warning}`);
}

/**
 * Confirm an action on one entity: "✓ Deleted: Buy milk (42)". The short id
 * is looked up (never minted) so entities leaving circulation don't pollute
 * the alias cache.
 */
export function outputEntityAction(action: string, name: string, id?: string): void {
	const label = action.charAt(0).toUpperCase() + action.slice(1);
	const shortId = id != null ? peekShortId(id) : undefined;
	outputSuccess(`${label}: ${bold(name)}${shortId != null ? ` (${shortId})` : ""}`);
}

// ── Batch results ───────────────────────────────────────────────────────────

export interface BatchItem {
	ok: boolean;
	id?: string;
	name?: string;
	error?: string;
	changes?: string[];
	warnings?: string[];
}

export interface BatchSummary {
	succeeded: number;
	failed: number;
	/** Successful items that carried warnings. */
	partial: number;
}

/** Human rendering shared by every stdin-driven batch verb. */
export function outputBatchSummary(title: string, results: readonly BatchItem[]): BatchSummary {
	const succeeded = results.filter((r) => r.ok);
	const failed = results.filter((r) => !r.ok);
	const partial = succeeded.filter((r) => (r.warnings?.length ?? 0) > 0);

	outputSuccess(`${title}: ${succeeded.length} succeeded, ${failed.length} failed`);
	if (succeeded.length > 0) {
		console.log(green(`\n✓ ${succeeded.length} succeeded:`));
		for (const r of succeeded) {
			const label = r.name ?? r.id ?? "unknown";
			console.log(`  ${label}${r.id ? ` (${r.id})` : ""}`);
			for (const change of r.changes ?? []) console.log(dim(`    • ${change}`));
			for (const warning of r.warnings ?? []) outputWarning(`  ${label}: ${warning}`);
		}
	}
	if (failed.length > 0) {
		console.log(red(`\n✗ ${failed.length} failed:`));
		for (const r of failed) console.log(`  ${r.name ?? r.id ?? "unknown"}: ${r.error}`);
	}
	console.log(dim(`\nTotal: ${results.length} items`));
	return { succeeded: succeeded.length, failed: failed.length, partial: partial.length };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/core/output.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/output.ts test/core/output.test.ts
git commit -m "feat(output): shared warnings, entity-action and batch-summary renderers

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 7: `readJsonArray()` in `core/stdin.ts` and `withStdin()` test helper

**Files:**
- Modify: `src/core/stdin.ts`
- Modify: `test/helpers/env.ts`
- Test: `test/core/stdin.test.ts` (new file)

**Interfaces:**
- Produces: `readJsonArray<T>(example: string, itemLabel: string, validateItem?: (item: T, index: number) => string | undefined): Promise<T[]>` — throws `CLIError` for: no input, invalid JSON, non-array, empty array, or the first validation message.
- Produces (test): `withStdin<T>(value: unknown, fn: () => T | Promise<T>): Promise<T>` — swaps `process.stdin` for the duration.

- [ ] **Step 1: Add `withStdin` to `test/helpers/env.ts` and make `withStreamTTY` promise-aware**

`withStreamTTY` currently restores `isTTY` synchronously, so an async `fn` loses the forced value at its first `await`. Rewrite its body to the same pattern `withEnv` uses (call `fn()`, and if the result is a `Promise`, `return result.finally(restore) as T`, otherwise restore and return). Then append:

```ts
/** Replace `process.stdin` (a Readable, or `{ isTTY: true }`) for the duration of `fn`. */
export async function withStdin<T>(value: unknown, fn: () => T | Promise<T>): Promise<T> {
	const original = process.stdin;
	Object.defineProperty(process, "stdin", { value, configurable: true });
	try {
		return await fn();
	} finally {
		Object.defineProperty(process, "stdin", { value: original, configurable: true });
	}
}
```

- [ ] **Step 2: Write the failing tests** — `test/core/stdin.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import { CLIError } from "../../src/core/errors.js";
import { readJsonArray } from "../../src/core/stdin.js";
import { withStdin } from "../helpers/env.js";

const EXAMPLE = "echo '[]' | of bulk add";

function piped(text: string) {
	return Readable.from([Buffer.from(text)]);
}

describe("readJsonArray", () => {
	test("returns the parsed array", async () => {
		const items = await withStdin(piped('[{"name":"A"}]'), () =>
			readJsonArray<{ name: string }>(EXAMPLE, "task objects"),
		);
		expect(items).toEqual([{ name: "A" }]);
	});

	test.each([
		["", "No input provided. Expected JSON array of task objects on stdin."],
		["not json", "Invalid JSON input"],
		['{"a":1}', "Input must be an array of task objects"],
		["[]", "Input array is empty"],
	])("rejects %j", async (input, message) => {
		const run = withStdin(piped(input), () => readJsonArray(EXAMPLE, "task objects"));
		await expect(run).rejects.toBeInstanceOf(CLIError);
		await expect(run).rejects.toThrow(message);
	});

	test("runs the per-item validator and reports the first failure", async () => {
		const run = withStdin(piped('[{"name":"A"},{}]'), () =>
			readJsonArray<{ name?: string }>(EXAMPLE, "task objects", (item, i) =>
				item.name ? undefined : `Task at index ${i} is missing required field 'name'`,
			),
		);
		await expect(run).rejects.toThrow("Task at index 1 is missing required field 'name'");
	});

	test("still fails fast on a TTY", async () => {
		const run = withStdin({ isTTY: true }, () => readJsonArray(EXAMPLE, "task objects"));
		await expect(run).rejects.toThrow("Example: echo '[]' | of bulk add");
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `bun test test/core/stdin.test.ts`
Expected: FAIL — `readJsonArray` not exported.

- [ ] **Step 4: Implement** — append to `src/core/stdin.ts`:

```ts
/**
 * Read a JSON array payload from stdin and validate its shape. Every
 * stdin-driven verb (bulk add/update/complete, inbox process-many) goes
 * through here so the error wording is identical.
 *
 * @param itemLabel - plural noun for messages, e.g. "task objects"
 * @param validateItem - optional per-item check returning an error message
 */
export async function readJsonArray<T>(
	example: string,
	itemLabel: string,
	validateItem?: (item: T, index: number) => string | undefined,
): Promise<T[]> {
	const input = await readStdin(example);
	if (!input.trim()) {
		throw new CLIError(`No input provided. Expected JSON array of ${itemLabel} on stdin.`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch (error) {
		throw new CLIError(
			`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!Array.isArray(parsed)) throw new CLIError(`Input must be an array of ${itemLabel}`);
	if (parsed.length === 0) throw new CLIError("Input array is empty");
	if (validateItem) {
		for (let i = 0; i < parsed.length; i++) {
			const problem = validateItem(parsed[i] as T, i);
			if (problem) throw new CLIError(problem);
		}
	}
	return parsed as T[];
}
```

- [ ] **Step 5: Run to verify pass**

Run: `bun test test/core/stdin.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/stdin.ts test/helpers/env.ts test/core/stdin.test.ts
git commit -m "feat(stdin): readJsonArray shared by every stdin-driven verb

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 8: One CLI test harness, root `--json` declared once

**Files:**
- Modify: `test/helpers/run.ts`
- Modify: `test/integration/cli.test.ts` (top ~80 lines)
- Modify: `test/integration/stdin.test.ts`

**Interfaces:**
- Produces: `runCommand(setup, argv, client?)` now declares the root `--json` option (mirrors `buildProgram`); `runCommandWithStdin(setup, argv, stdinText, client?)`.

- [ ] **Step 1: Update `test/helpers/run.ts`**

In `runCommand`, change `program.name("of").exitOverride();` to:

```ts
	// Mirror the real program: --json is a root option only (src/program.ts).
	program.name("of").option("--json", "Output in JSON format").exitOverride();
```

Append:

```ts
import { Readable } from "node:stream";
import { withStdin } from "./env.js";

/** `runCommand` with `stdinText` piped in as the command's stdin. */
export function runCommandWithStdin(
	setup: (program: Command, client: OmniFocusClient) => void,
	argv: string[],
	stdinText: string,
	client?: OmniFocusClient,
): Promise<RunResult> {
	return withStdin(Readable.from([Buffer.from(stdinText)]), () => runCommand(setup, argv, client));
}
```

(Place the imports at the top of the file.)

- [ ] **Step 2: Delete the duplicate harness in `test/integration/cli.test.ts`**

Remove the local `runCommand` and `runCommandWithStdin` functions and the now-unused `Readable`/`Command` imports; add `import { runCommand, runCommandWithStdin } from "../helpers/run.js";`. Keep every test body as is (the shared helper returns a superset: `exitCode` too).

- [ ] **Step 3: Delete the duplicate harness in `test/integration/stdin.test.ts`**

Replace `runWithTtyStdin` with:

```ts
import { withStdin } from "../helpers/env.js";
import { runCommand } from "../helpers/run.js";

function runWithTtyStdin(
	setup: (program: Command, client: OmniFocusClient) => void,
	argv: string[],
) {
	return withStdin({ isTTY: true }, () => runCommand(setup, argv));
}
```

Existing cases call `expect(runWithTtyStdin(...)).rejects...` or similar — keep their assertions; if a case asserted on a thrown `CLIError` from `parseAsync`, note that `runCommand` stubs `process.exit`, so assert on `(await runWithTtyStdin(...)).stderr` containing "No input on stdin" instead.

- [ ] **Step 4: Run the whole suite**

Run: `bun test`
Expected: PASS — a test that previously relied on `process.exit` throwing must be adjusted to assert `exitCode`/`stderr` from the shared helper.

- [ ] **Step 5: Commit**

```bash
git add test/helpers/run.ts test/integration/cli.test.ts test/integration/stdin.test.ts
git commit -m "test: one CLI harness with root --json, drop duplicated runners

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 9: `defineNoun()` registrar with aliases; all noun index files become specs

**Files:**
- Create: `src/commands/noun.ts`
- Modify: `src/commands/task/index.ts`, `src/commands/task/notification/index.ts`, `src/commands/project/index.ts`, `src/commands/tag/index.ts`, `src/commands/folder/index.ts`, `src/commands/inbox/index.ts`, `src/commands/bulk/index.ts`
- Test: `test/commands/noun.test.ts`, `test/integration/program.test.ts`

**Interfaces:**
- Produces: `type Register = (parent: Command, client: OmniFocusClient) => void`, `interface NounSpec { name: string; alias?: string; description: string; verbs: readonly Register[] }`, `defineNoun(spec: NounSpec): Register`.
- The exported names `registerTaskCommands`, `registerProjectCommands`, `registerTagCommands`, `registerFolderCommands`, `registerInboxCommands`, `registerBulkCommands`, `registerNotificationCommands` keep their names and `(program, client)` signature.

- [ ] **Step 1: Write the failing tests** — `test/commands/noun.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { defineNoun } from "../../src/commands/noun.js";
import { createMockClient } from "../fixtures/mock-client.js";

describe("defineNoun", () => {
	test("mounts the noun with alias and description, then every verb under it", () => {
		const seen: string[] = [];
		const register = defineNoun({
			name: "widget",
			alias: "w",
			description: "Manage widgets",
			verbs: [
				(parent) => {
					seen.push(parent.name());
					parent.command("list");
				},
			],
		});
		const program = new Command();
		register(program, createMockClient());
		const noun = program.commands.find((c) => c.name() === "widget");
		expect(noun?.aliases()).toEqual(["w"]);
		expect(noun?.description()).toBe("Manage widgets");
		expect(noun?.commands.map((c) => c.name())).toEqual(["list"]);
		expect(seen).toEqual(["widget"]);
	});

	test("nested nouns need no alias", () => {
		const program = new Command();
		defineNoun({ name: "inner", description: "d", verbs: [] })(program, createMockClient());
		expect(program.commands[0]?.aliases()).toEqual([]);
	});
});
```

And add to `test/integration/program.test.ts` inside `describe("program assembly")`:

```ts
	test("every noun has its one-letter alias", () => {
		const program = buildProgram(createMockClient());
		const aliases = Object.fromEntries(program.commands.map((c) => [c.name(), c.aliases()]));
		expect(aliases).toMatchObject({
			task: ["t"],
			project: ["p"],
			tag: ["g"],
			folder: ["f"],
			inbox: ["i"],
			bulk: ["b"],
		});
	});

	test("`of t list` dispatches like `of task list`", async () => {
		const client = createMockClient();
		const program = buildProgram(client).exitOverride();
		const origLog = console.log;
		console.log = () => {};
		try {
			await program.parseAsync(["t", "list", "--json"], { from: "user" });
		} finally {
			console.log = origLog;
		}
		expect(client.listTasks).toHaveBeenCalledTimes(1);
	});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/commands/noun.test.ts test/integration/program.test.ts`
Expected: FAIL — module `noun.js` missing; aliases empty.

- [ ] **Step 3: Implement `src/commands/noun.ts`**

```ts
/**
 * The one noun registrar. A noun (`task`, `project`, ...) is a Commander
 * subcommand carrying a stable one-letter alias and a list of verb
 * register functions. Each noun's index.ts is a NounSpec literal and
 * nothing else; nested nouns (task notification) use the same mechanism
 * without an alias.
 */

import type { Command } from "commander";
import type { OmniFocusClient } from "../core/types.js";

export type Register = (parent: Command, client: OmniFocusClient) => void;

export interface NounSpec {
	name: string;
	/** One stable letter, top-level nouns only. */
	alias?: string;
	description: string;
	verbs: readonly Register[];
}

export function defineNoun(spec: NounSpec): Register {
	return (parent, client) => {
		const cmd = parent.command(spec.name).description(spec.description);
		if (spec.alias) cmd.alias(spec.alias);
		for (const register of spec.verbs) register(cmd, client);
	};
}
```

- [ ] **Step 4: Rewrite each index file as a spec**

`src/commands/task/index.ts`:

```ts
import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerCompleteCommand } from "./complete.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerMoveCommand } from "./move.js";
import { registerNotificationCommands } from "./notification/index.js";
import { registerSearchCommand } from "./search.js";
import { registerShowCommand } from "./show.js";
import { registerSubtaskCommand } from "./subtask.js";
import { registerTagCommand } from "./tag.js";
import { registerUpdateCommand } from "./update.js";

export const registerTaskCommands = defineNoun({
	name: "task",
	alias: "t",
	description: "Manage tasks",
	verbs: [
		registerAddCommand,
		registerListCommand,
		registerShowCommand,
		registerSearchCommand,
		registerUpdateCommand,
		registerMoveCommand,
		registerCompleteCommand,
		registerTagCommand,
		registerDeleteCommand,
		registerSubtaskCommand,
		registerNotificationCommands,
	],
});
```

`src/commands/task/notification/index.ts`:

```ts
import { defineNoun } from "../../noun.js";
import { registerAddCommand } from "./add.js";
import { registerClearCommand } from "./clear.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerUpdateCommand } from "./update.js";

export const registerNotificationCommands = defineNoun({
	name: "notification",
	description: "Manage task notifications",
	verbs: [
		registerListCommand,
		registerAddCommand,
		registerUpdateCommand,
		registerDeleteCommand,
		registerClearCommand,
	],
});
```

`src/commands/project/index.ts`:

```ts
import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerRenameCommand } from "./rename.js";
import { registerShowCommand } from "./show.js";
import { registerUpdateCommand } from "./update.js";

export const registerProjectCommands = defineNoun({
	name: "project",
	alias: "p",
	description: "Manage projects",
	verbs: [
		registerAddCommand,
		registerListCommand,
		registerShowCommand,
		registerUpdateCommand,
		registerRenameCommand,
		registerDeleteCommand,
	],
});
```

`src/commands/tag/index.ts`:

```ts
import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerRenameCommand } from "./rename.js";
import { registerTasksCommand } from "./tasks.js";

export const registerTagCommands = defineNoun({
	name: "tag",
	alias: "g",
	description: "Manage tags",
	verbs: [
		registerAddCommand,
		registerListCommand,
		registerTasksCommand,
		registerRenameCommand,
		registerDeleteCommand,
	],
});
```

`src/commands/folder/index.ts`:

```ts
import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerListCommand } from "./list.js";

export const registerFolderCommands = defineNoun({
	name: "folder",
	alias: "f",
	description: "Manage folders",
	verbs: [registerAddCommand, registerListCommand],
});
```

`src/commands/inbox/index.ts`:

```ts
import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerListCommand } from "./list.js";
import { registerProcessManyCommand } from "./process-many.js";
import { registerProcessCommand } from "./process.js";

export const registerInboxCommands = defineNoun({
	name: "inbox",
	alias: "i",
	description: "Manage the inbox",
	verbs: [
		registerListCommand,
		registerAddCommand,
		registerProcessCommand,
		registerProcessManyCommand,
	],
});
```

`src/commands/bulk/index.ts`:

```ts
import { defineNoun } from "../noun.js";
import { registerBulkCompleteCommand } from "./complete.js";
import { registerBulkCreateCommand } from "./create.js";
import { registerBulkUpdateCommand } from "./update.js";

export const registerBulkCommands = defineNoun({
	name: "bulk",
	alias: "b",
	description: "Bulk operations from stdin JSON",
	verbs: [registerBulkCreateCommand, registerBulkUpdateCommand, registerBulkCompleteCommand],
});
```

- [ ] **Step 5: Run to verify pass**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/noun.ts src/commands/*/index.ts src/commands/task/notification/index.ts test/commands/noun.test.ts test/integration/program.test.ts
git commit -m "feat(commands): defineNoun registrar with one-letter noun aliases

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 10: Alias-aware shell completions

**Files:**
- Modify: `src/commands/completion.ts`
- Test: `test/integration/completion.test.ts`

**Interfaces:**
- `CommandNode` gains `aliases: string[]`; every generator emits aliases wherever the command name is matched or offered.

- [ ] **Step 1: Write the failing tests** — add to `test/integration/completion.test.ts`:

```ts
	test("bash offers noun aliases and matches them in verb cases", () => {
		const script = generateCompletionScript(program, "bash");
		const nouns = /nouns="([^"]*)"/.exec(script)?.[1]?.split(" ") ?? [];
		for (const alias of ["t", "p", "g", "f", "i", "b"]) expect(nouns).toContain(alias);
		expect(script).toContain("task|t) COMPREPLY=");
	});

	test("zsh describes aliases and matches them in verb cases", () => {
		const script = generateCompletionScript(program, "zsh");
		expect(script).toContain("'t:Manage tasks'");
		expect(script).toContain("task|t) _describe");
	});

	test("fish offers aliases at top level and in subcommand guards", () => {
		const script = generateCompletionScript(program, "fish");
		expect(script).toContain("-n __fish_use_subcommand -a t -d 'Manage tasks'");
		expect(script).toContain("'__fish_seen_subcommand_from task t' -a list");
	});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/integration/completion.test.ts`
Expected: FAIL on the three new tests.

- [ ] **Step 3: Implement** in `src/commands/completion.ts`:

Extend the node and tree builder:

```ts
interface CommandNode {
	name: string;
	aliases: string[];
	description: string;
	children: CommandNode[];
}

function toTree(cmd: Command, depth = 0): CommandNode[] {
	const nodes: CommandNode[] = [];
	for (const sub of cmd.commands) {
		nodes.push({
			name: sub.name(),
			aliases: sub.aliases(),
			description: sub.description(),
			children: depth < 2 ? toTree(sub, depth + 1) : [],
		});
	}
	return nodes;
}

/** Every spelling of a command: its name plus aliases. */
function spellings(node: CommandNode): string[] {
	return [node.name, ...node.aliases];
}

/** `case` pattern matching any spelling: `task|t`. */
function casePattern(node: CommandNode): string {
	return spellings(node).join("|");
}

/** `[[ ... ]]` clause matching any spelling of `node` at shell word `word`. */
function wordMatches(word: string, node: CommandNode): string {
	return `( ${spellings(node)
		.map((s) => `${word} == "${s}"`)
		.join(" || ")} )`;
}
```

bash: `const nouns = tree.flatMap(spellings).join(" ");` — verb case lines use `casePattern(noun)`; nested ifs become
`if [[ ${wordMatches('"${words[1]}"', noun)} && ${wordMatches('"${words[2]}"', verb)} ]]; then`.

zsh: `nounItems` emits one `'spelling:desc'` line per spelling; verb cases use `casePattern(noun)`; nested ifs use `wordMatches('"$words[2]"', noun)` and `wordMatches('"$words[3]"', verb)`.

fish: top-level loop emits one `complete ... -a <spelling> -d '...'` per spelling; the subcommand guard becomes `'__fish_seen_subcommand_from ${spellings(noun).join(" ")}'`; the nested detector function uses `contains -- "$cmd[2]" ${spellings(noun).join(" ")}; and contains -- "$cmd[3]" ${spellings(verb).join(" ")}`.

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/integration/completion.test.ts`
Expected: PASS (all existing regression tests included).

- [ ] **Step 5: Commit**

```bash
git add src/commands/completion.ts test/integration/completion.test.ts
git commit -m "feat(completion): complete noun aliases in bash, zsh and fish

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 11: Task verbs, part 1 — `add` (absorbs `subtask`), `list`, `show`, `search`

**Files:**
- Modify: `src/commands/task/add.ts`, `src/commands/task/list.ts`, `src/commands/task/show.ts`, `src/commands/task/search.ts`, `src/commands/task/index.ts`
- Delete: `src/commands/task/subtask.ts`
- Modify: `src/core/types.ts` (remove `SubtaskCreateOptions`, `createSubtask`), `src/core/client.ts` (remove `createSubtask`), `test/fixtures/mock-client.ts` (remove `createSubtask`), `src/jxa/bridge.js` (remove `ops["task.subtask"]`)
- Test: `test/integration/cli.test.ts`

- [ ] **Step 1: Write the failing tests** — in `test/integration/cli.test.ts`, `describe("task commands")`:

```ts
	test("task add --parent-id creates a subtask through createTask", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task", "add", "Buy milk", "--parent-id", "abc", "--json",
		]);
		const call = (client.createTask as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ name: "Buy milk", parentId: "abc", parent: undefined });
	});

	test("task add --parent resolves a short id alias to parentId", async () => {
		const alias = String(assignShortIds(["real-parent-id"]).get("real-parent-id"));
		const { client } = await runCommand(registerTaskCommands, [
			"task", "add", "Buy milk", "--parent", alias, "--json",
		]);
		const call = (client.createTask as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ parentId: "real-parent-id", parent: undefined });
	});

	test("the subtask verb no longer exists", async () => {
		await expect(
			runCommand(registerTaskCommands, ["task", "subtask", "x", "--parent-id", "a"]),
		).rejects.toThrow();
	});
```

(The file already imports `assignShortIds`.)

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/integration/cli.test.ts -t "task add --parent"`
Expected: FAIL — unknown option `--parent-id`.

- [ ] **Step 3: Rewrite `src/commands/task/add.ts`**

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess, outputTaskDetail, outputWarnings } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskCreate, taskCreateOptions } from "../options/task-fields.js";

/**
 * `of task add <name>` — one creator for inbox tasks, project tasks and
 * subtasks: `--project` files it, `--parent`/`--parent-id` nests it, neither
 * lands it in the inbox. Also mounted as `of inbox add` (see ../inbox/index.ts).
 */
export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("add")
		.description("Create a task, in the inbox unless --project or --parent is given")
		.argument("<name>", "Task name");
	taskCreateOptions(cmd);
	cmd.action(
		runAction(async (ctx, name: string) => {
			const data = unwrapBridgeResponse(await client.createTask(readTaskCreate(name, ctx.opts)));
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputWarnings(data.warnings);
			outputTaskDetail(data.task, ctx.format);
			if (data.parent) outputSuccess(`Subtask of: ${data.parent.name} [${data.parent.project}]`);
		}),
	);
}
```

- [ ] **Step 4: Rewrite `list.ts`, `show.ts`, `search.ts`**

`src/commands/task/list.ts`:

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputLimitNotice, outputTaskList } from "../../core/output.js";
import type { OmniFocusClient, TaskFilter } from "../../core/types.js";
import { runAction } from "../action.js";
import { limitOption } from "../options/common.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("list")
		.description("List tasks")
		.option("--filter <filter>", "Filter type, inbox|available|flagged|due-soon|overdue|all", "available");
	limitOption(cmd, 20);
	cmd.action(
		runAction(async (ctx) => {
			const limit = ctx.opts.limit as number;
			const tasks = unwrapBridgeResponse(
				await client.listTasks({
					filter: ctx.opts.filter as TaskFilter,
					limit,
					includeNotifications: ctx.format === "json",
				}),
			);
			outputTaskList(tasks, ctx.format);
			outputLimitNotice(tasks.length, limit);
		}),
	);
}
```

`src/commands/task/show.ts`:

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputTaskDetail } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

export function registerShowCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("show").description("Show task detail");
	taskRefArgument(cmd);
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			// task.get resolves ids through its byId tier, so a resolved id works as the query.
			const resolved = readTaskRef(ref, ctx.opts);
			const task = unwrapBridgeResponse(
				await client.getTask(resolved.id ?? (ref as string), { includeNotifications: true }),
			);
			outputTaskDetail(task, ctx.format);
		}),
	);
}
```

`src/commands/task/search.ts`:

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputLimitNotice, outputTaskList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { limitOption } from "../options/common.js";

export function registerSearchCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("search")
		.description("Search tasks by keyword")
		.argument("<query>", "Search query");
	limitOption(cmd, 50);
	cmd.action(
		runAction(async (ctx, query: string) => {
			const limit = ctx.opts.limit as number;
			const tasks = unwrapBridgeResponse(await client.searchTasks(query, limit));
			outputTaskList(tasks, ctx.format);
			outputLimitNotice(tasks.length, limit);
		}),
	);
}
```

- [ ] **Step 5: Remove the subtask verb and op**

- `git rm src/commands/task/subtask.ts`; drop `registerSubtaskCommand` from `src/commands/task/index.ts`.
- `src/core/types.ts`: delete `SubtaskCreateOptions` and the `createSubtask(...)` member.
- `src/core/client.ts`: delete `createSubtask` (and the now-unused type import).
- `test/fixtures/mock-client.ts`: delete the `createSubtask` mock.
- `src/jxa/bridge.js`: delete `ops["task.subtask"]` (~line 842 block).
- `README.md`: not yet (docs task).

- [ ] **Step 6: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS. Note `task list ... --json` at `cli.test.ts` "task list calls listTasks with filter" now proves the root-only `--json` works (it asserts `includeNotifications: true`).

- [ ] **Step 7: Commit**

```bash
git add -A src/commands/task src/core src/jxa/bridge.js test
git commit -m "refactor(task): add absorbs subtask; list/show/search on runAction and option groups

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 12: Task verbs, part 2 — `update`, `complete`, `move`, `tag`, `delete`

**Files:**
- Modify: `src/commands/task/update.ts`, `complete.ts`, `move.ts`, `tag.ts`, `delete.ts`

- [ ] **Step 1: Confirm the guarding tests exist** — `test/integration/cli.test.ts` already covers: `task complete` (short id, `--json`), `task delete` with/without `--confirm` and its confirmation line, `task update`, `task tag`; `test/integration/complete.test.ts` and `move.test.ts` cover their verbs. No new tests are needed for behaviour; run them after the rewrite.

- [ ] **Step 2: Rewrite `src/commands/task/update.ts`**

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputChanges, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";
import { readTaskEdits, taskEditOptions } from "../options/task-fields.js";

export function registerUpdateCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("update").description("Update a task");
	taskRefArgument(cmd);
	taskEditOptions(cmd)
		.option("--complete", "Mark the task complete")
		.option("--incomplete", "Mark the task incomplete");
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			const data = unwrapBridgeResponse(
				await client.updateTask({
					...readTaskRef(ref, ctx.opts),
					...readTaskEdits(ctx.opts),
					complete: ctx.opts.complete as boolean | undefined,
					incomplete: ctx.opts.incomplete as boolean | undefined,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputChanges("task", data.task?.name ?? data.id, data.changes);
		}),
	);
}
```

- [ ] **Step 3: Rewrite `src/commands/task/complete.ts`** — keep the multi-ref logic; only the declaration, ref resolution and confirmation change:

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError, CLIError } from "../../core/errors.js";
import { outputEntityAction, outputError, outputJson } from "../../core/output.js";
import type { BridgeCandidate, OmniFocusClient, TaskCompleteResult } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

type RefOutcome =
	| { ref: string | undefined; ok: true; data: TaskCompleteResult }
	| { ref: string | undefined; ok: false; error: BridgeError };

/**
 * `of task complete <refs...>` — each reference is resolved and completed
 * through the single-task `task.complete` op so every one of them keeps
 * short-id aliases, fuzzy names, disambiguation candidates and the
 * "already completed" hint.
 */
export function registerCompleteCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("complete").description("Complete one or more tasks");
	taskRefArgument(cmd, "variadic");
	cmd.option("--incomplete", "Mark as incomplete instead");
	cmd.action(
		runAction(async (ctx, refs: string[]) => {
			const explicitId = ctx.opts.id as string | undefined;
			const incomplete = ctx.opts.incomplete as boolean | undefined;
			if (refs.length > 1 && explicitId) {
				throw new CLIError("--id can only be combined with a single task reference");
			}

			const completeOne = async (ref: string | undefined): Promise<RefOutcome> => {
				const resolved = readTaskRef(ref, ctx.opts);
				try {
					const response = await client.completeTask(ref as string, {
						id: resolved.id,
						incomplete,
					});
					return { ref, ok: true, data: unwrapBridgeResponse(response) };
				} catch (error) {
					if (error instanceof BridgeError) return { ref, ok: false, error };
					throw error;
				}
			};

			if (refs.length <= 1) {
				const outcome = await completeOne(refs[0]);
				if (!outcome.ok) throw outcome.error;
				if (ctx.format === "json") outputJson(outcome.data);
				else confirm(outcome.data);
				return;
			}

			const outcomes: RefOutcome[] = [];
			for (const ref of refs) {
				const outcome = await completeOne(ref);
				outcomes.push(outcome);
				if (ctx.format === "human") {
					if (outcome.ok) confirm(outcome.data);
					else outputError(outcome.error);
				}
			}
			if (ctx.format === "json") outputJson(outcomes.map(toJsonResult));
			if (outcomes.some((o) => !o.ok)) process.exit(1);
		}),
	);
}

function confirm(data: TaskCompleteResult): void {
	outputEntityAction(data.action === "completed" ? "completed" : "marked incomplete", data.name, data.id);
}

type JsonResult =
	| ({ ref: string | undefined; ok: true } & TaskCompleteResult)
	| { ref: string | undefined; ok: false; error: string; candidates?: BridgeCandidate[] };

function toJsonResult(outcome: RefOutcome): JsonResult {
	if (outcome.ok) return { ref: outcome.ref, ok: true, ...outcome.data };
	const { message, candidates } = outcome.error;
	return {
		ref: outcome.ref,
		ok: false,
		error: message,
		...(candidates && candidates.length > 0 ? { candidates } : {}),
	};
}
```

- [ ] **Step 4: Rewrite `src/commands/task/move.ts`** — declaration only; logic unchanged:

```ts
	const cmd = parent
		.command("move")
		.description("Reschedule a task due, defer or planned date");
	taskRefArgument(cmd);
	cmd.argument("[due]", "New due date, e.g. tomorrow, 'fri 5pm', 2d, 2026-09-10, clear");
	taskDateOptions(cmd, { fields: ["defer", "planned"], clearable: true });
	cmd.action(
		runAction(async (ctx, ...positionals: (string | undefined)[]) => {
			// ...existing body, replacing `resolveTaskRef(ref, explicitId)` with
			// `readTaskRef(ref, ctx.opts)` and importing taskDateOptions from
			// ../options/task-fields.js and readTaskRef/taskRefArgument from ../options/refs.js
```

Remove the `.option("--id ...")`, `--defer`, `--planned`, `--json` lines and the `resolveTaskRef` import.

- [ ] **Step 5: Rewrite `src/commands/task/tag.ts`**

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

export function registerTagCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("tag").description("Apply tags to a task");
	taskRefArgument(cmd, "required");
	cmd.argument("<tags...>", "Tags to apply");
	cmd.action(
		runAction(async (ctx, ref: string, tags: string[]) => {
			const resolved = readTaskRef(ref, ctx.opts);
			const data = unwrapBridgeResponse(await client.applyTag(ref, tags, { id: resolved.id }));
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Applied tags to: ${data.name}`);
			outputSuccess(`  Applied: ${data.applied.join(", ")}`);
		}),
	);
}
```

- [ ] **Step 6: Rewrite `src/commands/task/delete.ts`**

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputEntityAction, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("delete").description("Delete a task permanently");
	taskRefArgument(cmd);
	confirmOption(cmd);
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			requireConfirm(ctx.opts, "task delete");
			const resolved = readTaskRef(ref, ctx.opts);
			const data = unwrapBridgeResponse(
				await client.deleteTask(ref as string, { id: resolved.id, confirm: true }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputEntityAction(data.action, data.name, data.id);
		}),
	);
}
```

- [ ] **Step 7: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS. `complete.test.ts` expects `"✓ Completed: Task A"` — `outputEntityAction` bolds the name, which is a no-op without a TTY, so the assertion holds.

- [ ] **Step 8: Commit**

```bash
git add src/commands/task
git commit -m "refactor(task): update/complete/move/tag/delete on runAction and option groups

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 13: Notification verbs

**Files:**
- Modify: `src/commands/task/notification/{list,add,update,delete,clear}.ts`

- [ ] **Step 1: Confirm guarding tests** — `cli.test.ts` has "task notification clear requires --confirm" and the notification add/update/delete/list tests. Run `bun test test/integration/cli.test.ts -t notification` and note they pass before the change.

- [ ] **Step 2: Rewrite each file.** Common shape: declare with `taskRefArgument(cmd)`, wrap in `runAction`, resolve with `readTaskRef(ref, ctx.opts)`, replace every `outputError(msg); process.exit(1); return;` with `throw new CLIError(msg)`, drop the `--json` option and try/catch.

`list.ts`:

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { outputJson, outputSuccess } from "../../../core/output.js";
import type { OFTaskNotification, OmniFocusClient } from "../../../core/types.js";
import { dim } from "../../../core/ui/colors.js";
import { runAction } from "../../action.js";
import { readTaskRef, taskRefArgument } from "../../options/refs.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("list").description("List notifications for a task");
	taskRefArgument(cmd);
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			const data = unwrapBridgeResponse(
				await client.listTaskNotifications({ query: ref, id: readTaskRef(ref, ctx.opts).id }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Notifications for: ${data.taskName}`);
			if (data.notifications.length === 0) {
				console.log(dim("No notifications found."));
				return;
			}
			for (const notification of data.notifications) console.log(formatNotification(notification));
		}),
	);
}

function formatNotification(notification: OFTaskNotification): string {
	// unchanged
}
```

`add.ts` action body (declaration: `taskRefArgument(cmd)` then the `--kind/--at/--offset/--repeat` options unchanged):

```ts
		runAction(async (ctx, ref: string | undefined) => {
			const kind = ctx.opts.kind as string;
			const at = ctx.opts.at as string | undefined;
			const offsetSeconds = ctx.opts.offset as number | undefined;
			const repeatSeconds = ctx.opts.repeat as number | undefined;
			if (kind !== "absolute" && kind !== "due-relative") {
				throw new CLIError("--kind must be one of: absolute, due-relative");
			}
			if (kind === "absolute" && !at) throw new CLIError("--at is required when --kind absolute is used");
			if (kind === "absolute" && offsetSeconds != null) {
				throw new CLIError("--offset cannot be used with --kind absolute");
			}
			if (kind === "due-relative" && offsetSeconds == null) {
				throw new CLIError("--offset is required when --kind due-relative is used");
			}
			if (kind === "due-relative" && at) throw new CLIError("--at cannot be used with --kind due-relative");
			if (repeatSeconds != null && repeatSeconds < 0) {
				throw new CLIError("--repeat must be a non-negative duration");
			}
			const data = unwrapBridgeResponse(
				await client.addTaskNotification({
					query: ref,
					id: readTaskRef(ref, ctx.opts).id,
					kind,
					at,
					offsetSeconds,
					repeatSeconds,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Added notification ${data.notification.id} to: ${data.taskName}`);
		}),
```

`update.ts`, `delete.ts`: same transformation; `--notification-id` missing → `throw new CLIError("--notification-id is required")`; update's "at least one" and negative-repeat checks become `throw new CLIError(...)` with the existing messages.

`clear.ts`:

```ts
	const cmd = parent.command("clear").description("Delete all notifications from a task");
	taskRefArgument(cmd);
	confirmOption(cmd, "Confirm deletion of all notifications");
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			requireConfirm(ctx.opts, "task notification clear");
			const data = unwrapBridgeResponse(
				await client.clearTaskNotifications({
					query: ref,
					id: readTaskRef(ref, ctx.opts).id,
					confirm: true,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Cleared ${data.cleared} notification(s) from: ${data.taskName}`);
		}),
	);
```

- [ ] **Step 3: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/task/notification
git commit -m "refactor(task): notification verbs on runAction and taskRefArgument

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 14: Project verbs

**Files:**
- Modify: `src/commands/project/{add,list,show,update,rename,delete}.ts`

- [ ] **Step 1: Guarding tests** — `cli.test.ts` covers project add, list, show, update, rename, delete (with/without `--confirm`). Run `bun test test/integration/cli.test.ts -t project` first.

- [ ] **Step 2: Rewrite**

`add.ts`:

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { formatProjectDetail, outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create a project")
		.argument("<name>", "Project name")
		.option("--folder <folder>", "Parent folder")
		.option("--status <status>", "Project status")
		.option("--sequential", "Make the project sequential")
		.option("--note <text>", "Project note")
		.option("--flag", "Flag the project")
		.action(
			runAction(async (ctx, name: string) => {
				const data = unwrapBridgeResponse(
					await client.createProject({
						name,
						folder: ctx.opts.folder as string | undefined,
						status: ctx.opts.status as string | undefined,
						sequential: ctx.opts.sequential as boolean | undefined,
						note: ctx.opts.note as string | undefined,
						flag: ctx.opts.flag as boolean | undefined,
					}),
				);
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Created project: ${data.project.name}`);
				console.log(formatProjectDetail(data.project));
			}),
		);
}
```

`list.ts`:

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputProjectList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { listQueryOptions, readListQuery } from "../options/common.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("list")
		.description("List projects")
		.option("--status <status>", "Filter by status, active|done|onhold|dropped")
		.option("--folder <folder>", "Filter by folder")
		.option("--full", "Verbose output");
	listQueryOptions(cmd, { count: "Include task counts", activeOnly: "Show only active projects" });
	cmd.action(
		runAction(async (ctx) => {
			const data = unwrapBridgeResponse(
				await client.listProjects({
					...readListQuery(ctx.opts),
					status: ctx.opts.status as string | undefined,
					folder: ctx.opts.folder as string | undefined,
					full: ctx.opts.full as boolean | undefined,
				}),
			);
			outputProjectList(data, ctx.format);
		}),
	);
}
```

`show.ts`:

```ts
	const cmd = parent.command("show").description("Show project detail");
	projectRefArgument(cmd);
	cmd.action(
		runAction(async (ctx, project: string) => {
			const data = unwrapBridgeResponse(
				await client.getProject(project, { id: ctx.opts.id as string | undefined }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			console.log(formatProjectDetail(data));
		}),
	);
```

`update.ts` (declaration `projectRefArgument(cmd, "optional")` + the existing `--name/--note/--note-append/--status/--folder/--sequential/--parallel/--flag/--unflag` options; body):

```ts
		runAction(async (ctx, project: string | undefined) => {
			const data = unwrapBridgeResponse(
				await client.updateProject({
					query: project,
					id: ctx.opts.id as string | undefined,
					name: ctx.opts.name as string | undefined,
					note: ctx.opts.note as string | undefined,
					noteAppend: ctx.opts.noteAppend as string | undefined,
					status: ctx.opts.status as string | undefined,
					folder: ctx.opts.folder as string | undefined,
					sequential: ctx.opts.sequential as boolean | undefined,
					parallel: ctx.opts.parallel as boolean | undefined,
					flag: ctx.opts.flag as boolean | undefined,
					unflag: ctx.opts.unflag as boolean | undefined,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputChanges("project", data.project.name, data.changes);
		}),
```

`rename.ts`:

```ts
	const cmd = parent.command("rename").description("Rename a project");
	projectRefArgument(cmd);
	cmd.argument("<new-name>", "New project name");
	cmd.action(
		runAction(async (ctx, project: string, newName: string) => {
			const data = unwrapBridgeResponse(
				await client.renameProject(project, newName, { id: ctx.opts.id as string | undefined }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Renamed project: ${bold(data.oldName)} → ${bold(data.newName)}`);
		}),
	);
```

`delete.ts`:

```ts
	const cmd = parent.command("delete").description("Delete a project");
	projectRefArgument(cmd);
	confirmOption(cmd);
	cmd.action(
		runAction(async (ctx, project: string) => {
			requireConfirm(ctx.opts, "project delete");
			const data = unwrapBridgeResponse(
				await client.deleteProject(project, { id: ctx.opts.id as string | undefined, confirm: true }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputEntityAction(data.action, data.name);
		}),
	);
```

- [ ] **Step 3: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/project
git commit -m "refactor(project): verbs on runAction, projectRefArgument and list-query group

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 15: Tag and folder verbs

**Files:**
- Modify: `src/commands/tag/{add,list,tasks,rename,delete}.ts`, `src/commands/folder/{add,list}.ts`

- [ ] **Step 1: Guarding tests** — `cli.test.ts` covers tag add/list/tasks/rename/delete and folder add/list. Run `bun test test/integration/cli.test.ts -t "tag|folder"` first.

- [ ] **Step 2: Rewrite**

`tag/add.ts`:

```ts
	parent
		.command("add")
		.description("Create a tag")
		.argument("<tag>", "Tag name")
		.action(
			runAction(async (ctx, tag: string) => {
				const data = unwrapBridgeResponse(await client.createTag(tag));
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Created tag: ${data.name}`);
			}),
		);
```

`tag/list.ts`:

```ts
	const cmd = parent.command("list").description("List tags");
	listQueryOptions(cmd, { count: "Include task counts", activeOnly: "Show only tags with active tasks" });
	cmd.action(
		runAction(async (ctx) => {
			const data = unwrapBridgeResponse(await client.listTags(readListQuery(ctx.opts)));
			outputTagList(data, ctx.format);
		}),
	);
```

`tag/tasks.ts`:

```ts
	const cmd = parent
		.command("tasks")
		.description("List tasks with this tag")
		.argument("<tag>", "Tag name");
	limitOption(cmd, 50);
	cmd.action(
		runAction(async (ctx, tag: string) => {
			const limit = ctx.opts.limit as number;
			const data = unwrapBridgeResponse(await client.listTasksByTag(tag, limit));
			outputTaskList(data, ctx.format);
			outputLimitNotice(data.length, limit);
		}),
	);
```

`tag/rename.ts`:

```ts
	parent
		.command("rename")
		.description("Rename a tag")
		.argument("<tag>", "Current tag name")
		.argument("<new-name>", "New tag name")
		.action(
			runAction(async (ctx, tag: string, newName: string) => {
				const data = unwrapBridgeResponse(await client.renameTag(tag, newName));
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Renamed tag from "${data.oldName}" to "${data.newName}"`);
			}),
		);
```

`tag/delete.ts`:

```ts
	const cmd = parent.command("delete").description("Delete a tag").argument("<tag>", "Tag name");
	confirmOption(cmd);
	cmd.action(
		runAction(async (ctx, tag: string) => {
			requireConfirm(ctx.opts, "tag delete");
			const data = unwrapBridgeResponse(await client.deleteTag(tag, { confirm: true }));
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputEntityAction(data.action, data.name);
		}),
	);
```

`folder/add.ts`:

```ts
	parent
		.command("add")
		.description("Create a folder")
		.argument("<folder>", "Folder name")
		.option("--parent <folder>", "Parent folder name")
		.action(
			runAction(async (ctx, folder: string) => {
				const data = unwrapBridgeResponse(
					await client.createFolder(folder, { parent: ctx.opts.parent as string | undefined }),
				);
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				const parentInfo = data.parentFolder ? ` in ${data.parentFolder}` : "";
				outputSuccess(`Created folder: ${data.name}${parentInfo}`);
			}),
		);
```

`folder/list.ts`:

```ts
	const cmd = parent.command("list").description("List folders");
	listQueryOptions(cmd, { count: "Include project counts" });
	cmd.action(
		runAction(async (ctx) => {
			const data = unwrapBridgeResponse(await client.listFolders(readListQuery(ctx.opts)));
			outputFolderList(data, ctx.format);
		}),
	);
```

If `FolderListOptions`/`TagListOptions` reject the extra `activeOnly`/`search` keys under `exactOptionalPropertyTypes`, widen those interfaces to `extends ListQuery`-compatible optional fields rather than filtering keys in the verb.

- [ ] **Step 3: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/tag src/commands/folder src/core/types.ts
git commit -m "refactor(tag,folder): verbs on runAction and shared list-query group

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 16: Inbox verbs — `add` remounts task add; `list`, `process`, `process-many`

**Files:**
- Delete: `src/commands/inbox/add.ts`
- Modify: `src/commands/inbox/index.ts`, `src/commands/inbox/{list,process,process-many}.ts`
- Modify: `src/core/types.ts` (remove `addInbox`), `src/core/client.ts` (remove `addInbox`), `test/fixtures/mock-client.ts` (remove `addInbox`), `src/jxa/bridge.js` (remove `ops["inbox.add"]`), `test/jxa/stdin-command.test.ts` (probe op)
- Test: `test/integration/cli.test.ts`

- [ ] **Step 1: Write the failing tests** — replace the "inbox add in human mode does not print undefined" test with:

```ts
	test("inbox add is the task add verb and creates through createTask", async () => {
		const { client } = await runCommand(registerInboxCommands, ["inbox", "add", "Quick note", "--json"]);
		expect(client.createTask).toHaveBeenCalledTimes(1);
		const call = (client.createTask as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ name: "Quick note", project: undefined });
	});

	test("inbox add in human mode does not print undefined", async () => {
		const { stdout } = await withStreamTTY(process.stdout, true, () =>
			runCommand(registerInboxCommands, ["inbox", "add", "Quick note"]),
		);
		expect(stdout.some((line) => line.includes("undefined"))).toBeFalse();
	});
```

(import `withStreamTTY` from `../helpers/env.js`).

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/integration/cli.test.ts -t "inbox add"`
Expected: FAIL — `createTask` not called (still `addInbox`).

- [ ] **Step 3: Remount and remove**

- `git rm src/commands/inbox/add.ts`.
- `src/commands/inbox/index.ts`: `import { registerAddCommand } from "../task/add.js";` (replace the local import); verbs list unchanged in order.
- `src/core/types.ts`: delete the `addInbox(...)` member. `src/core/client.ts`: delete `addInbox`. `test/fixtures/mock-client.ts`: delete the `addInbox` mock.
- `src/jxa/bridge.js`: delete `ops["inbox.add"]`.
- `test/jxa/stdin-command.test.ts`: change both `op: "inbox.add"` probes to `op: "task.create"` (same "Task name required" error) and update the comment.

- [ ] **Step 4: Rewrite `list.ts`**

```ts
	const cmd = parent
		.command("list")
		.description("List inbox items")
		.option("--newest-first", "Sort by creation date, newest first, before applying --limit");
	limitOption(cmd, 50);
	cmd.action(
		runAction(async (ctx) => {
			const limit = ctx.opts.limit as number;
			const data = unwrapBridgeResponse(
				await client.listInbox(limit, { newestFirst: ctx.opts.newestFirst as boolean | undefined }),
			);
			outputTaskList(data, ctx.format);
			outputLimitNotice(data.length, limit);
		}),
	);
```

- [ ] **Step 5: Rewrite `process.ts`**

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputChanges, outputJson, outputSuccess } from "../../core/output.js";
import { resolveTaskRef } from "../../core/short-ids.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";
import { readTaskEdits, taskEditOptions } from "../options/task-fields.js";

export function registerProcessCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("process")
		.description("Process an inbox item")
		.argument("<ref>", "Inbox item, short id or OmniFocus id");
	taskEditOptions(cmd)
		.option("--complete", "Mark as complete")
		.option("--delete", "Delete the item")
		.option("--dry-run", "Show what would change without applying");
	confirmOption(cmd, "Confirm deletion, required with --delete");
	cmd.action(
		runAction(async (ctx, ref: string) => {
			const opts = ctx.opts;
			if (opts.delete && !opts.dryRun) requireConfirm(opts, "inbox process --delete");
			const data = unwrapBridgeResponse(
				await client.processInbox({
					id: resolveTaskRef(ref).id ?? ref,
					...readTaskEdits(opts),
					complete: opts.complete as boolean | undefined,
					delete: opts.delete as boolean | undefined,
					dryRun: opts.dryRun as boolean | undefined,
					confirm: opts.confirm as boolean | undefined,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			if (opts.dryRun) outputSuccess("Dry run - changes that would be made:");
			else if (opts.delete) outputSuccess(`Deleted inbox item: ${ref}`);
			else if (opts.complete) outputSuccess(`Completed inbox item: ${ref}`);
			else outputSuccess(`Processed inbox item: ${ref}`);
			if (data.changes && data.changes.length > 0) outputChanges("inbox item", ref, data.changes);
		}),
	);
}
```

- [ ] **Step 6: Rewrite `process-many.ts`**

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputBatchSummary, outputJson } from "../../core/output.js";
import { readJsonArray } from "../../core/stdin.js";
import type { InboxProcessOptions, OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";

interface BatchProcessResult {
	ok: boolean;
	id?: string;
	error?: string;
	changes?: string[];
	taskName?: string;
}

function hasValidId(input: unknown): input is { id: string } {
	if (!input || typeof input !== "object") return false;
	const record = input as Record<string, unknown>;
	return typeof record.id === "string" && record.id.trim().length > 0;
}

function wantsDelete(item: unknown): boolean {
	return Boolean(item && typeof item === "object" && (item as Record<string, unknown>).delete);
}

export function registerProcessManyCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("process-many").description("Process many inbox items from stdin JSON");
	confirmOption(cmd, "Confirm deletion of any items with delete true");
	cmd.action(
		runAction(async (ctx) => {
			const items = await readJsonArray<unknown>(
				`echo '[{"id":"id1","project":"Errands"}]' | of inbox process-many`,
				"inbox process objects",
			);
			// Reject the whole batch up front rather than failing partway through.
			if (items.some(wantsDelete)) requireConfirm(ctx.opts, "inbox process-many with delete items");

			const results: BatchProcessResult[] = [];
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (!hasValidId(item)) {
					results.push({ ok: false, error: `Item at index ${i} is missing required field 'id'` });
					continue;
				}
				// Confirm provenance must come from --confirm only; never trust a
				// caller-supplied `confirm` field in stdin JSON.
				const processOptions = {
					...(item as InboxProcessOptions),
					confirm: ctx.opts.confirm === true,
				} as InboxProcessOptions;
				try {
					const data = unwrapBridgeResponse(await client.processInbox(processOptions));
					results.push({ ok: true, id: item.id, taskName: data.task?.name, changes: data.changes });
				} catch (error) {
					if (error instanceof BridgeError) {
						results.push({ ok: false, id: item.id, error: error.format() });
						continue;
					}
					throw error;
				}
			}

			if (ctx.format === "json") {
				outputJson(results);
				return;
			}
			const summary = outputBatchSummary(
				"Inbox batch processing completed",
				results.map((r) => ({ ...r, name: r.taskName })),
			);
			if (summary.failed > 0) process.exit(1);
		}),
	);
}
```

- [ ] **Step 7: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS — the existing process-many tests assert the JSON result shape (`taskName`), which is unchanged.

- [ ] **Step 8: Commit**

```bash
git add -A src/commands/inbox src/core src/jxa/bridge.js test
git commit -m "refactor(inbox): add is task add; list/process/process-many on shared groups; drop inbox.add op

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 17: Bulk verbs (`bulk add`) and standalone commands

**Files:**
- Rename: `src/commands/bulk/create.ts` → `src/commands/bulk/add.ts`
- Modify: `src/commands/bulk/{index,update,complete}.ts`, `src/commands/{forecast,review,stats,collect}.ts`
- Test: `test/integration/stdin.test.ts`, `test/integration/cli.test.ts`

- [ ] **Step 1: Write the failing tests** — in `stdin.test.ts` change `{ name: "bulk create", ..., argv: ["bulk", "create"] }` to `{ name: "bulk add", ..., argv: ["bulk", "add"] }`. In `cli.test.ts` add:

```ts
describe("bulk commands", () => {
	test("bulk add validates names, then calls bulkCreate with the array", async () => {
		const { client } = await runCommandWithStdin(
			registerBulkCommands,
			["bulk", "add", "--json"],
			'[{"name":"A"},{"name":"B"}]',
		);
		expect(client.bulkCreate).toHaveBeenCalledWith([{ name: "A" }, { name: "B" }]);
	});

	test("bulk add rejects an item without a name before calling the client", async () => {
		const { client, stderr, exitCode } = await runCommandWithStdin(
			registerBulkCommands,
			["bulk", "add", "--json"],
			'[{"name":"A"},{}]',
		);
		expect(client.bulkCreate).not.toHaveBeenCalled();
		expect(stderr.join("\n")).toContain("Task at index 1 is missing required field 'name'");
		expect(exitCode).toBe(1);
	});

	test("bulk create no longer exists", async () => {
		await expect(runCommand(registerBulkCommands, ["bulk", "create"])).rejects.toThrow();
	});
});
```

(import `registerBulkCommands` from `../../src/commands/bulk/index.js`.)

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/integration/cli.test.ts -t bulk`
Expected: FAIL — unknown command `add`.

- [ ] **Step 3: `git mv src/commands/bulk/create.ts src/commands/bulk/add.ts` and rewrite it**

```ts
import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputBatchSummary, outputJson } from "../../core/output.js";
import { readJsonArray } from "../../core/stdin.js";
import type { BulkCreateInput, OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerBulkAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create tasks from stdin JSON")
		.action(
			runAction(async (ctx) => {
				const tasks = await readJsonArray<BulkCreateInput>(
					`echo '[{"name":"Task 1"}]' | of bulk add`,
					"task objects",
					(task, i) =>
						task && typeof task === "object" && task.name
							? undefined
							: `Task at index ${i} is missing required field 'name'`,
				);
				const results = unwrapBridgeResponse(await client.bulkCreate(tasks));
				if (ctx.format === "json") {
					outputJson(results);
					return;
				}
				const summary = outputBatchSummary("Bulk create completed", results);
				if (summary.failed > 0 || summary.partial > 0) process.exit(1);
			}),
		);
}
```

`bulk/index.ts`: import `registerBulkAddCommand` from `./add.js` and list it first.

- [ ] **Step 4: Rewrite `bulk/update.ts` and `bulk/complete.ts`**

`update.ts` body:

```ts
			runAction(async (ctx) => {
				const updates = await readJsonArray<BulkUpdateInput>(
					`echo '[{"id":"abc","due":"2026-04-01"}]' | of bulk update`,
					"update objects",
					(update, i) =>
						update && typeof update === "object" && update.id
							? undefined
							: `Update object at index ${i} is missing required field 'id'`,
				);
				const results = unwrapBridgeResponse(await client.bulkUpdate(updates));
				if (ctx.format === "json") {
					outputJson(results);
					return;
				}
				if (outputBatchSummary("Bulk update completed", results).failed > 0) process.exit(1);
			}),
```

`complete.ts` (keeps `--incomplete`):

```ts
			runAction(async (ctx) => {
				const incomplete = ctx.opts.incomplete as boolean | undefined;
				const taskIds = await readJsonArray<string>(
					`echo '["id1","id2"]' | of bulk complete`,
					"task ID strings",
					(id, i) =>
						typeof id === "string" && id.trim()
							? undefined
							: `Task ID at index ${i} must be a non-empty string`,
				);
				const results = unwrapBridgeResponse(await client.bulkComplete(taskIds, { incomplete }));
				if (ctx.format === "json") {
					outputJson(results);
					return;
				}
				const action = incomplete ? "incomplete" : "complete";
				if (outputBatchSummary(`Bulk ${action} completed`, results).failed > 0) process.exit(1);
			}),
```

Remove the `dim/green/red` imports and the `--json` options from all three.

- [ ] **Step 5: Standalone commands** — in `forecast.ts`, `review.ts`, `stats.ts`, `collect.ts` replace the wrapper only. Before:

```ts
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				// body using `opts` and `format`
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
```

After:

```ts
		.action(
			runAction(async (ctx) => {
				const { opts, format } = ctx;
				// body unchanged
			}),
		);
```

Drop the `BridgeError`, `outputError`, `resolveFormat` imports where they become unused; add `import { runAction } from "./action.js";`.

- [ ] **Step 6: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 7: Grep for leftovers** — all four must print nothing:

```bash
grep -rn '"--json"' src/commands | grep -v completion.ts
grep -rn "instanceof BridgeError" src/commands | grep -v "complete.ts\|process-many.ts"
grep -rn "function collect" src/commands
grep -rn "resolveFormat" src/commands | grep -v action.ts
```

- [ ] **Step 8: Commit**

```bash
git add -A src/commands test
git commit -m "refactor(bulk): create becomes add; batch verbs and reports on shared helpers

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 18: Remove root shortcuts

**Files:**
- Delete: `src/commands/shortcuts.ts`
- Modify: `src/program.ts`
- Test: `test/integration/complete.test.ts`, `test/integration/move.test.ts`

- [ ] **Step 1: Write the failing tests** — replace the `describe("root shortcut", ...)` block in `complete.test.ts` and the "registers `move` at the root and under task" test in `move.test.ts` with:

```ts
describe("registration", () => {
	test("complete lives under task only, never at the root", () => {
		const program = buildProgram(createMockClient());
		expect(program.commands.map((c) => c.name())).not.toContain("complete");
		const task = program.commands.find((c) => c.name() === "task");
		expect(task?.commands.map((c) => c.name())).toContain("complete");
	});
});
```

(and the same for `move`). Every remaining test that invoked `["complete", ...]` or `["move", ...]` at the root now invokes `["task", "complete", ...]` / `["t", "move", ...]` — use the alias in at least one test per file so the alias path is exercised end to end.

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/integration/complete.test.ts test/integration/move.test.ts`
Expected: FAIL — root still has `complete`/`move`.

- [ ] **Step 3: Remove**

`git rm src/commands/shortcuts.ts`; in `src/program.ts` delete the `registerShortcutCommands` import, the comment and the call.

- [ ] **Step 4: Verify**

Run: `bun run check && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src/commands/shortcuts.ts src/program.ts test/integration
git commit -m "feat!: remove root complete/move shortcuts in favour of noun aliases

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 19: Documentation, CLAUDE.md, agent skill

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `src/commands/docs.md`, `src/core/docs.md`, `src/jxa/docs.md`, `test/docs.md`, `~/.agents/skills/omnifocus-cli/SKILL.md`

- [ ] **Step 1: README**

- "Usage" paragraph (line ~52): replace the shortcut sentence with:

  > Commands follow a noun-verb pattern: `of <noun> <verb> [args] [options]`. Every noun has a one-letter alias — `of t list` is `of task list`, `of p`, `of g` (tag), `of f`, `of i`, `of b` — and nothing else is abbreviated, so aliases stay stable.

- Short-IDs example block: `of complete 42` → `of t complete 42`, `of complete 42 127` → `of t complete 42 127`, `of move 42 tomorrow` → `of t move 42 tomorrow`.
- Tasks block: drop the two `of complete ...` lines and the `of move` comments' "shortcut" wording; `of task subtask "Buy milk" --parent "Buy groceries"` → `of task add "Buy milk" --parent "Buy groceries"`; add `of t complete 42 43 "Call mom"` with the "several refs" comment. Dates section: `of move` → `of t move`.
- Inbox block: keep `of inbox add "Quick thought"` and add the comment `# same command as task add; lands in the inbox without --project`.
- Bulk block: `of bulk create` → `of bulk add`.
- Command Reference table: remove `task subtask`, `complete`, `move` rows; rename `bulk create` → `bulk add`; add a `task add --parent` note to the `task add` row; add a row `t p g f i b | One-letter aliases for task, project, tag, folder, inbox, bulk`.

- [ ] **Step 2: CLAUDE.md** — in "Architecture → CLI layer" replace the **Root shortcuts** sentence with:

  > **Nouns are declared, not hand-registered.** Each `src/commands/<noun>/index.ts` is a `defineNoun({ name, alias, description, verbs })` literal (`src/commands/noun.ts`); aliases are one stable letter (`t p g f i b`), verbs never get aliases, and the root gets no verb shortcuts. Every verb wraps its handler in `runAction()` and declares shared flags through the option groups in `src/commands/options/` (`taskRefArgument`, `taskCreateOptions`/`taskEditOptions`, `listQueryOptions`, `limitOption`, `confirmOption` + `requireConfirm`). A verb file contains only what is specific to that verb; if a flag or argument is needed by two verbs it belongs in `options/`.

  In "Conventions & gotchas": remove "`of complete` *is* `registerCompleteCommand` registered twice"; change the `complete is variadic` bullet to start "**`task complete` is variadic.** `of t complete 42 43 "Call mom"`…"; in the Dates bullet replace "`of move <ref> [due] ...` (also a root shortcut)" with "`of task move <ref> [due] [--defer] [--planned]`"; add "**`--json` is a root option only.** Never declare it on a verb — Commander recognises it after the subcommand and `runAction` reads it via `optsWithGlobals()`."; in the stdin bullet replace `readStdin(example)` with `readJsonArray(example, itemLabel, validate?)`; add "**One creator.** `task add` handles inbox tasks, project tasks (`--project`) and subtasks (`--parent`/`--parent-id`); `inbox add` mounts the same register function. The bridge's `createTaskRecord()` is shared by `task.create` and `bulk.create`."

- [ ] **Step 3: Noridocs** — invoke the `updating-noridocs` skill for `src/commands/docs.md`, `src/core/docs.md`, `src/jxa/docs.md`, `test/docs.md`, giving it this change summary: defineNoun/aliases, option groups, runAction universal, root-only `--json`, `outputWarnings`/`outputEntityAction`/`outputBatchSummary`, `readJsonArray`, `createTaskRecord` + removed ops `task.subtask`/`inbox.add`, removed `shortcuts.ts`/`subtask.ts`/`inbox/add.ts`, `bulk add`, shared test harness + `withStdin` + `parseCommand`, harness constructors.

- [ ] **Step 4: Agent skill** — edit `~/.agents/skills/omnifocus-cli/SKILL.md`:

- Intro line: after "Noun-verb layout: …" add "Each noun has a one-letter alias (`t p g f i b`); prefer the full noun in scripts you show the user."
- Rule 6: `of task complete 42` stays.
- Quick reference: Reschedule row `of move --id <id> <due>` → `of task move --id <id> <due>` and drop "(`of task move` is the same command)"; Complete row `of complete` → `of task complete` (three places) and drop the parenthetical; Subtask row → `` `of task add "name" --parent-id <id>` `` ; Bulk section `of bulk create` → `of bulk add` (two places); Common mistakes `of bulk create` → `of bulk add`.

- [ ] **Step 5: Verify docs mention nothing removed**

```bash
grep -rn "of complete\|of move\|task subtask\|bulk create\|shortcuts.ts\|addInbox\|createSubtask\|inbox.add\|task.subtask" README.md CLAUDE.md src/*/docs.md src/*/*/docs.md test/docs.md ~/.agents/skills/omnifocus-cli/SKILL.md
```
Expected: no output.

- [ ] **Step 6: Commit** (the skill file lives outside the repo; save it, it is not committed here)

```bash
git add README.md CLAUDE.md src/commands/docs.md src/core/docs.md src/jxa/docs.md test/docs.md
git commit -m "docs: noun aliases, folded verbs, option groups, updated agent guidance

Claude-Session: https://claude.ai/code/session_01N1E9WJ3vCp3BnHJmzQAJ1X"
```

---

### Task 20: Final verification against the ledger

- [ ] **Step 1: Full gate**

Run: `bun run check && bun run typecheck && bun test && bun run build && ./of --help && ./of t --help && ./of completion zsh | head -20`
Expected: all green; `--help` lists `task|t`, `project|p`, `tag|g`, `folder|f`, `inbox|i`, `bulk|b` and no root `complete`/`move`.

- [ ] **Step 2: Ledger greps** — each must print nothing:

```bash
grep -rn '"--json"' src/commands | grep -v completion.ts          # --json only at root
grep -rn "process.exit" src/commands | grep -v "action.ts\|complete.ts\|process-many.ts\|bulk/"   # exits only where batches decide
grep -rn "outputError(" src/commands | grep -v "action.ts\|complete.ts"
grep -rn "function collect\b\|parseNumberOrString" src
grep -rn "Partial apply warning" src | grep -v output.ts
grep -rn "registerCompleteCommand\|registerMoveCommand" src | grep -v "task/"
grep -rn "program.command(\"" src/commands src/program.ts | grep -v "noun.ts\|forecast\|review\|stats\|collect\|completion"
ls src/commands/shortcuts.ts src/commands/task/subtask.ts src/commands/inbox/add.ts src/commands/bulk/create.ts 2>&1 | grep -v "No such file"
```

- [ ] **Step 3: Live smoke test on the real app (optional, macOS with OmniFocus)**

```bash
./of t add "plan smoke" --json | jq .id      # inbox task
./of i list --limit 3
./of t complete "plan smoke" --json
```

- [ ] **Step 4: Nothing to commit** — if the greps or build revealed anything, fix and commit with a `chore:` message, then stop.
