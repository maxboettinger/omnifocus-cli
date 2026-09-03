/**
 * End-to-end tests for the AI verbs (`task breakdown`, `task why`) through
 * the shared CLI harness, a mock OmniFocus client and a scripted fake AI.
 */

import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { registerTaskCommands } from "../../src/commands/task/index.js";
import { type FakeAI, createFakeAI } from "../fixtures/fake-ai.js";
import { createMockClient } from "../fixtures/mock-client.js";
import {
	MOCK_CREATE_TREE_RESULT,
	MOCK_TASK,
	errorResponse,
	successResponse,
} from "../fixtures/mock-responses.js";
import { withEnv, withStdin, withStreamTTY, withStreamWrite } from "../helpers/env.js";
import { runCommand } from "../helpers/run.js";

const HUMAN_ENV = { NO_COLOR: "1", CI: undefined, TERM: "xterm-256color" };

function planTask(key: string, name: string, extra: Record<string, unknown> = {}) {
	return {
		key,
		parentKey: null,
		name,
		note: "",
		estimateMinutes: 5,
		tags: [],
		flag: false,
		sequential: false,
		due: null,
		defer: null,
		...extra,
	};
}

const PLAN = {
	summary: "Two tiny steps.",
	sequential: true,
	questions: ["Which store?"],
	tasks: [
		planTask("1", "Open the shopping list app", { estimateMinutes: 1 }),
		planTask("2", "Add milk and eggs", { note: "Check the fridge first", tags: ["errand"] }),
		planTask("2.1", "Look in the fridge", { parentKey: "2", estimateMinutes: 2 }),
	],
};

const SHORTER_PLAN = {
	summary: "One step.",
	sequential: false,
	questions: [],
	tasks: [planTask("1", "Just buy milk", { estimateMinutes: 3 })],
};

/** A fake interactive terminal: TTY stdin fed by a script, prompts on stderr swallowed. */
async function runInteractive(
	argv: string[],
	script: string[],
	ai: FakeAI,
	client = createMockClient(),
) {
	const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => input });
	const stderrWrites: string[] = [];
	const stdoutWrites: string[] = [];
	// Feed each scripted line once the previous prompt has been written.
	let fed = 0;
	const feed = () => {
		if (fed < script.length) {
			const line = script[fed++] as string;
			setTimeout(() => input.write(line), 2);
		}
	};
	const result = await withEnv(HUMAN_ENV, () =>
		withStreamTTY(process.stdout, true, () =>
			withStdin(input, () =>
				withStreamWrite(
					process.stdout,
					(chunk) => stdoutWrites.push(chunk),
					() =>
						withStreamWrite(
							process.stderr,
							(chunk) => {
								stderrWrites.push(chunk);
								if (/[:?>] $/.test(chunk)) feed();
							},
							() => runCommand(registerTaskCommands, argv, client, ai),
						),
				),
			),
		),
	);
	return { ...result, stderrWrites, stdoutWrites };
}

describe("task breakdown", () => {
	test("--json prints the plan and applies nothing", async () => {
		const ai = createFakeAI({ plans: [PLAN] });
		const { client, stdout, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "breakdown", "Buy groceries", "--context", "Kitchen only", "--json"],
			undefined,
			ai,
		);
		expect(exitCode).toBeUndefined();
		expect(client.getTaskContext).toHaveBeenCalledWith({ query: "Buy groceries" });
		expect(client.createTaskTree).not.toHaveBeenCalled();
		const out = JSON.parse(stdout.join("\n"));
		expect(out.target).toEqual({ id: MOCK_TASK.id, name: MOCK_TASK.name, project: "Errands" });
		expect(out.applied).toBeNull();
		expect(out.plan.tasks.map((t: { name: string }) => t.name)).toEqual([
			"Open the shopping list app",
			"Add milk and eggs",
			"Look in the fridge",
		]);
		// The request carried the prompt file, the rendered context and the user's extra text.
		const req = ai.requests[0];
		expect(req?.temperature).toBe(0.2);
		expect(req?.messages[0]?.role).toBe("system");
		expect(req?.messages[0]?.content).toContain("nano tasks");
		expect(req?.messages[1]?.role).toBe("user");
		expect(req?.messages[1]?.content).toContain("## Target task\n- Name: Buy groceries");
		expect(req?.messages[1]?.content).toContain("Kitchen only");
		expect(req?.messages[1]?.content).toContain("Break the target task down");
	});

	test("--id and --model pass straight through", async () => {
		const ai = createFakeAI({ plans: [PLAN] });
		const { client } = await runCommand(
			registerTaskCommands,
			["task", "breakdown", "--id", "task-abc123", "--model", "openai/gpt-4.1-mini", "--json"],
			undefined,
			ai,
		);
		expect(client.getTaskContext).toHaveBeenCalledWith({ id: "task-abc123" });
		expect(ai.requests[0]?.model).toBe("openai/gpt-4.1-mini");
	});

	test("--json --apply creates the tree and reports it", async () => {
		const ai = createFakeAI({ plans: [PLAN] });
		const { client, stdout, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "breakdown", "Buy groceries", "--json", "--apply"],
			undefined,
			ai,
		);
		expect(exitCode).toBeUndefined();
		expect(client.createTaskTree).toHaveBeenCalledWith({
			parentId: MOCK_TASK.id,
			sequential: true,
			tasks: [
				expect.objectContaining({
					key: "1",
					parentKey: null,
					name: "Open the shopping list app",
					estimate: 1,
				}),
				expect.objectContaining({ key: "2", note: "Check the fridge first", tags: ["errand"] }),
				expect.objectContaining({ key: "2.1", parentKey: "2", name: "Look in the fridge" }),
			],
		});
		const out = JSON.parse(stdout.join("\n"));
		expect(out.applied).toEqual(MOCK_CREATE_TREE_RESULT);
	});

	test("--json --apply exits 1 when an item failed", async () => {
		const client = createMockClient();
		(client.createTaskTree as ReturnType<typeof import("bun:test").mock>).mockImplementation(() =>
			Promise.resolve(
				successResponse({
					...MOCK_CREATE_TREE_RESULT,
					created: [{ key: "1", ok: false, name: "x", error: "nope" }],
				}),
			),
		);
		const { exitCode } = await runCommand(
			registerTaskCommands,
			["task", "breakdown", "Buy groceries", "--json", "--apply"],
			client,
			createFakeAI({ plans: [PLAN] }),
		);
		expect(exitCode).toBe(1);
	});

	test("an unknown task fails before any model call", async () => {
		const client = createMockClient();
		(client.getTaskContext as ReturnType<typeof import("bun:test").mock>).mockImplementation(() =>
			Promise.resolve(errorResponse('Task not found: "zzz"')),
		);
		const ai = createFakeAI({ plans: [PLAN] });
		const { stderr, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "breakdown", "zzz", "--json"],
			client,
			ai,
		);
		expect(exitCode).toBe(1);
		expect(JSON.parse(stderr[0] as string)).toEqual({ ok: false, error: 'Task not found: "zzz"' });
		expect(ai.requests).toEqual([]);
	});

	test("without a ref or --id it fails fast", async () => {
		const { exitCode, stderr } = await runCommand(registerTaskCommands, [
			"task",
			"breakdown",
			"--json",
		]);
		expect(exitCode).toBe(1);
		expect(stderr[0]).toContain("Provide a task reference or --id");
	});

	test("human mode without a terminal refuses unless --apply is given", async () => {
		const { exitCode, stderr } = await withEnv(HUMAN_ENV, () =>
			withStreamTTY(process.stdout, true, () =>
				withStdin({ isTTY: false }, () =>
					runCommand(
						registerTaskCommands,
						["task", "breakdown", "Buy groceries"],
						undefined,
						createFakeAI({ plans: [PLAN] }),
					),
				),
			),
		);
		expect(exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("pass --apply");
	});

	test("human mode: preview, revise with feedback, then apply", async () => {
		const ai = createFakeAI({ plans: [PLAN, SHORTER_PLAN] });
		const { client, stdout, exitCode } = await runInteractive(
			["task", "breakdown", "Buy groceries"],
			["r\n", "Make it a single step\n", "a\n"],
			ai,
		);
		expect(exitCode).toBeUndefined();
		const text = stdout.join("\n");
		expect(text).toContain("Plan for: Buy groceries");
		expect(text).toContain("Open the shopping list app");
		expect(text).toContain("Open questions:");
		expect(text).toContain("Which store?");
		expect(text).toContain("Just buy milk");
		expect(text).toContain("Created 2 of 2 subtasks under Buy groceries");
		// The revision request carried the previous plan and the feedback.
		expect(ai.requests).toHaveLength(2);
		const revision = ai.requests[1]?.messages ?? [];
		expect(revision.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
		expect(revision[2]?.content).toBe(JSON.stringify(PLAN));
		expect(revision[3]?.content).toBe("Make it a single step");
		// Only the revised plan was applied.
		expect(client.createTaskTree).toHaveBeenCalledTimes(1);
		expect(client.createTaskTree).toHaveBeenCalledWith(
			expect.objectContaining({
				sequential: false,
				tasks: [expect.objectContaining({ name: "Just buy milk" })],
			}),
		);
	});

	test("human mode: quitting at the preview changes nothing", async () => {
		const { client, stdout } = await runInteractive(
			["task", "breakdown", "Buy groceries"],
			["q\n"],
			createFakeAI({ plans: [PLAN] }),
		);
		expect(client.createTaskTree).not.toHaveBeenCalled();
		expect(stdout.join("\n")).toContain("Nothing changed.");
	});

	test("human mode: Esc at the preview changes nothing", async () => {
		const { client, stdout } = await runInteractive(
			["task", "breakdown", "Buy groceries"],
			["\x1b"],
			createFakeAI({ plans: [PLAN] }),
		);
		expect(client.createTaskTree).not.toHaveBeenCalled();
		expect(stdout.join("\n")).toContain("Nothing changed.");
	});

	test("human mode with --apply skips the prompt", async () => {
		const { client, stdout } = await withEnv(HUMAN_ENV, () =>
			withStreamTTY(process.stdout, true, () =>
				withStdin({ isTTY: false }, () =>
					runCommand(
						registerTaskCommands,
						["task", "breakdown", "Buy groceries", "--apply"],
						undefined,
						createFakeAI({ plans: [PLAN] }),
					),
				),
			),
		);
		expect(client.createTaskTree).toHaveBeenCalledTimes(1);
		expect(stdout.join("\n")).toContain("Created 2 of 2 subtasks");
	});
});

describe("task why", () => {
	test("refuses to run in JSON mode or without a terminal", async () => {
		const ai = createFakeAI({ replies: ["Q?"] });
		const json = await runCommand(registerTaskCommands, ["task", "why", "--json"], undefined, ai);
		expect(json.exitCode).toBe(1);
		expect(JSON.parse(json.stderr[0] as string).error).toContain("interactive session");
		const piped = await withEnv(HUMAN_ENV, () =>
			withStreamTTY(process.stdout, true, () =>
				withStdin({ isTTY: false }, () =>
					runCommand(registerTaskCommands, ["task", "why", "Buy groceries"], undefined, ai),
				),
			),
		);
		expect(piped.exitCode).toBe(1);
		expect(ai.requests).toEqual([]);
	});

	test("runs turn by turn with the task context until the user quits", async () => {
		const ai = createFakeAI({ replies: ["What is the first step?", "What makes that hard?"] });
		const { client, stdout, stdoutWrites } = await runInteractive(
			["task", "why", "Buy groceries", "--context", "It has been on my list for weeks"],
			["Going to the store\n", "\x1b"],
			ai,
		);
		expect(client.getTaskContext).toHaveBeenCalledWith({ query: "Buy groceries" });
		const streamed = stdoutWrites.join("");
		expect(streamed).toContain("What is the first step?");
		expect(streamed).toContain("What makes that hard?");
		expect(stdout.join("\n")).toContain("Why: Buy groceries");
		expect(stdout.join("\n")).toContain("Session ended.");
		expect(ai.requests).toHaveLength(2);
		expect(ai.requests[0]?.temperature).toBe(0.7);
		expect(ai.requests[0]?.messages[0]?.content).toContain("five whys");
		expect(ai.requests[0]?.messages[1]?.content).toContain("## Target task\n- Name: Buy groceries");
		expect(ai.requests[0]?.messages[1]?.content).toContain("It has been on my list for weeks");
		const second = ai.requests[1]?.messages ?? [];
		expect(second.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
		expect(second[2]?.content).toBe("What is the first step?");
		expect(second[3]?.content).toBe("Going to the store");
	});

	test("without a ref it opens a general session and never touches OmniFocus", async () => {
		const ai = createFakeAI({ replies: ["What are you avoiding?"] });
		const { client, stdout } = await runInteractive(["task", "why"], ["/quit\n"], ai);
		expect(client.getTaskContext).not.toHaveBeenCalled();
		expect(ai.requests[0]?.messages[1]?.content).toContain("No specific task was given");
		expect(stdout.join("\n")).toContain("Session ended.");
	});
});
