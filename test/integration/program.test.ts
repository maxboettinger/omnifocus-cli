/**
 * Tests for the assembled Commander program (src/program.ts).
 *
 * Uses a mock client — no OmniFocus required.
 */

import { afterEach, describe, expect, type mock, test } from "bun:test";
import pkg from "../../package.json" with { type: "json" };
import { isProgressEnabled, setProgressEnabled, withProgress } from "../../src/core/ui/progress.js";
import { buildProgram } from "../../src/program.js";
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
