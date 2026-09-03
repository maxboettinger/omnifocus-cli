/**
 * Tests for the assembled Commander program (src/program.ts).
 *
 * Uses a mock client — no OmniFocus required.
 */

import { afterEach, describe, expect, type mock, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import pkg from "../../package.json" with { type: "json" };
import { isProgressEnabled, setProgressEnabled, withProgress } from "../../src/core/ui/progress.js";
import { buildProgram } from "../../src/program.js";
import { createFakeAI } from "../fixtures/fake-ai.js";
import { createMockClient } from "../fixtures/mock-client.js";
import { successResponse } from "../fixtures/mock-responses.js";
import { withEnv, withStreamTTY } from "../helpers/env.js";

const INTERACTIVE_ENV = { CI: undefined, TERM: "xterm-256color", NO_COLOR: "1" };

function fakeStream() {
	const writes: string[] = [];
	return {
		isTTY: true,
		columns: 80,
		writes,
		write(chunk: unknown) {
			writes.push(String(chunk));
			return true;
		},
		cursorTo: () => true,
		moveCursor: () => true,
		clearLine: () => true,
	};
}

/** Run the full program against a progress-wrapped mock client, silencing stdout. */
async function runWithProgress(argv: string[], stdoutIsTTY: boolean): Promise<string> {
	const inner = createMockClient();
	// Keep the op open long enough for a spinner frame to be painted.
	(inner.forecast as ReturnType<typeof mock>).mockImplementation(
		() =>
			new Promise((resolve) =>
				setTimeout(
					() =>
						resolve(
							successResponse({
								overdue: [],
								due_today: [],
								planned_today: [],
								deferred_today: [],
								flagged: [],
								upcoming: [],
								available_next: [],
								meta: {
									today: "2026-09-02",
									upcomingDays: 3,
									generatedAt: "2026-09-02T08:00:00.000Z",
									dragAlerts: [],
									totalEstimatedMinutes: 0,
									counts: { overdue: 0, dueToday: 0, plannedToday: 0 },
								},
							}),
						),
					20,
				),
			),
	);
	const stream = fakeStream();
	const program = buildProgram(withProgress(inner, { stream }));
	program.exitOverride();

	const origLog = console.log;
	console.log = () => {};
	try {
		await withEnv(INTERACTIVE_ENV, () =>
			withStreamTTY(process.stdout, stdoutIsTTY, () => program.parseAsync(argv, { from: "user" })),
		);
	} finally {
		console.log = origLog;
	}
	return stream.writes.join("");
}

afterEach(() => {
	setProgressEnabled(false);
});

describe("program assembly", () => {
	test("--version reports the package.json version", () => {
		const program = buildProgram(createMockClient());
		expect(program.version()).toBe(pkg.version);
	});

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

	test("every verb alias is one letter and unique within its noun", () => {
		const program = buildProgram(createMockClient());
		const verbAliases = (nounName: string) => {
			const noun = program.commands.find((c) => c.name() === nounName) as Command;
			return Object.fromEntries(
				noun.commands.filter((c) => c.aliases().length > 0).map((c) => [c.name(), c.aliases()]),
			);
		};
		expect(verbAliases("task")).toEqual({
			add: ["a"],
			list: ["l"],
			show: ["s"],
			search: ["f"],
			update: ["u"],
			move: ["m"],
			complete: ["c"],
			tag: ["g"],
			delete: ["d"],
			notification: ["n"],
			breakdown: ["b"],
			why: ["w"],
		});
		expect(verbAliases("project")).toEqual({
			add: ["a"],
			list: ["l"],
			show: ["s"],
			update: ["u"],
			rename: ["r"],
			delete: ["d"],
		});
		expect(verbAliases("tag")).toEqual({
			add: ["a"],
			list: ["l"],
			tasks: ["t"],
			rename: ["r"],
			delete: ["d"],
		});
		expect(verbAliases("folder")).toEqual({ add: ["a"], list: ["l"] });
		expect(verbAliases("inbox")).toEqual({ list: ["l"], add: ["a"], process: ["p"] });
		expect(verbAliases("bulk")).toEqual({ add: ["a"], update: ["u"], complete: ["c"] });
		for (const noun of program.commands) {
			const spellings = noun.commands.flatMap((c) => [c.name(), ...c.aliases()]);
			expect(new Set(spellings).size).toBe(spellings.length);
			for (const alias of noun.commands.flatMap((c) => c.aliases())) expect(alias).toHaveLength(1);
		}
	});

	test("`of t c 42` dispatches like `of task complete 42`", async () => {
		const client = createMockClient();
		const program = buildProgram(client).exitOverride();
		const origLog = console.log;
		console.log = () => {};
		try {
			await program.parseAsync(["t", "c", "Buy milk", "--json"], { from: "user" });
		} finally {
			console.log = origLog;
		}
		expect(client.completeTask).toHaveBeenCalledTimes(1);
	});

	test("`of t n l` reaches the nested notification noun", async () => {
		const client = createMockClient();
		const program = buildProgram(client).exitOverride();
		const origLog = console.log;
		console.log = () => {};
		try {
			await program.parseAsync(["t", "n", "l", "Buy milk", "--json"], { from: "user" });
		} finally {
			console.log = origLog;
		}
		expect(client.listTaskNotifications).toHaveBeenCalledTimes(1);
	});

	test("standalone commands keep their spelled-out aliases", () => {
		const program = buildProgram(createMockClient());
		const aliases = Object.fromEntries(program.commands.map((c) => [c.name(), c.aliases()]));
		expect(aliases).toMatchObject({ forecast: ["fc"] });
	});

	test("`of fc` dispatches like `of forecast`", async () => {
		const client = createMockClient();
		const program = buildProgram(client).exitOverride();
		const origLog = console.log;
		console.log = () => {};
		try {
			await program.parseAsync(["fc", "--json"], { from: "user" });
		} finally {
			console.log = origLog;
		}
		expect(client.forecast).toHaveBeenCalledTimes(1);
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
});

describe("progress gating by output format", () => {
	test("human mode on a terminal shows the spinner", async () => {
		const chrome = await runWithProgress(["forecast"], true);
		expect(chrome).toContain("Building forecast");
		expect(isProgressEnabled()).toBe(true);
	});

	test("--json on a terminal draws nothing", async () => {
		const chrome = await runWithProgress(["forecast", "--json"], true);
		expect(chrome).toBe("");
	});

	test("the global --json flag draws nothing", async () => {
		const chrome = await runWithProgress(["--json", "forecast"], true);
		expect(chrome).toBe("");
	});

	test("piped stdout (implicit JSON) draws nothing", async () => {
		const chrome = await runWithProgress(["forecast"], false);
		expect(chrome).toBe("");
	});
});

describe("AI seam", () => {
	test("a non-AI command never touches the AI client", async () => {
		const client = createMockClient();
		const ai = createFakeAI();
		const program = buildProgram(client, ai).exitOverride();
		const origLog = console.log;
		console.log = () => {};
		try {
			await program.parseAsync(["task", "list", "--json"], { from: "user" });
			await program.parseAsync(["forecast", "--json"], { from: "user" });
		} finally {
			console.log = origLog;
		}
		expect(ai.requests).toEqual([]);
	});

	test("only the OpenRouter adapter imports the SDK, and only dynamically", () => {
		const files: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) walk(path);
				else if (path.endsWith(".ts")) files.push(path);
			}
		};
		walk(join(import.meta.dir, "../../src"));
		const importers = files.filter((f) =>
			/^import\s+(?!type\b)[^;]*from\s+"@openrouter\/sdk/m.test(readFileSync(f, "utf8")),
		);
		// No static value import anywhere: the SDK must be `await import()`ed
		// so a `--json` listing never evaluates it.
		expect(importers).toEqual([]);
		const users = files.filter((f) => readFileSync(f, "utf8").includes("@openrouter/sdk"));
		expect(users.map((f) => f.split("/src/")[1])).toEqual(["core/ai/openrouter.ts"]);
	});
});
