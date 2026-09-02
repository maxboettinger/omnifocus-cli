/**
 * `of move` / `of task move` — reschedule a task's due/defer/planned dates.
 * Mock client only; date parsing itself is covered in test/jxa.
 */

import { afterEach, beforeEach, describe, expect, type mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerTaskCommands } from "../../src/commands/task/index.js";
import { assignShortIds } from "../../src/core/short-ids.js";
import { buildProgram } from "../../src/program.js";
import { createMockClient } from "../fixtures/mock-client.js";
import { MOCK_TASK, errorResponse, successResponse } from "../fixtures/mock-responses.js";
import { withEnv, withStreamTTY } from "../helpers/env.js";
import { runCommand } from "../helpers/run.js";

type Mock = ReturnType<typeof mock>;

let cacheDir: string;

beforeEach(() => {
	cacheDir = mkdtempSync(join(tmpdir(), "of-cli-move-"));
	process.env.OF_SHORT_ID_CACHE = join(cacheDir, "short-ids.json");
});

afterEach(() => {
	rmSync(cacheDir, { recursive: true, force: true });
});

function updateArgs(client: ReturnType<typeof createMockClient>): Record<string, unknown> {
	return (client.updateTask as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("registration", () => {
	test("move lives under task only, never at the root", () => {
		const program = buildProgram(createMockClient());
		expect(program.commands.map((c) => c.name())).not.toContain("move");
		const task = program.commands.find((c) => c.name() === "task");
		expect(task?.commands.map((c) => c.name())).toContain("move");
	});
});

describe("argument mapping", () => {
	test("`of t move 1 tomorrow` resolves the short id and sets only the due date", async () => {
		assignShortIds(["ofIdAAAAAAA"]);
		const { client } = await runCommand(registerTaskCommands, [
			"t",
			"move",
			"1",
			"tomorrow",
			"--json",
		]);
		expect(client.updateTask).toHaveBeenCalledTimes(1);
		expect(updateArgs(client)).toEqual({ query: "1", id: "ofIdAAAAAAA", due: "tomorrow" });
	});

	test("--defer and --planned set the other fields, combinable with a due date", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"move",
			"Buy milk",
			"fri",
			"--defer",
			"mon",
			"--planned",
			"thu",
			"--json",
		]);
		expect(updateArgs(client)).toMatchObject({
			query: "Buy milk",
			due: "fri",
			defer: "mon",
			planned: "thu",
		});
		expect(updateArgs(client).id).toBeUndefined();
	});

	test("`clear` is passed through to remove a date", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"move",
			"Buy milk",
			"clear",
			"--json",
		]);
		expect(updateArgs(client)).toMatchObject({ due: "clear" });
	});

	test("an explicit --id wins over the positional", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"move",
			"--id",
			"explicit",
			"--defer",
			"mon",
			"--json",
		]);
		expect(updateArgs(client)).toMatchObject({ id: "explicit", defer: "mon" });
	});

	test("with --id, a sole positional is the date, not the reference", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"move",
			"--id",
			"explicit",
			"tomorrow",
			"--json",
		]);
		expect(updateArgs(client)).toMatchObject({ id: "explicit", due: "tomorrow" });
		expect(updateArgs(client).query).toBeUndefined();
	});

	test("with no date at all it fails before touching OmniFocus", async () => {
		const { client, stderr, exitCode } = await runCommand(registerTaskCommands, [
			"task",
			"move",
			"Buy milk",
			"--json",
		]);
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("date");
	});
});

describe("output", () => {
	const moved = {
		...MOCK_TASK,
		dueDate: new Date(2026, 8, 3, 18, 0).toISOString(),
		deferDate: new Date(2026, 8, 1, 8, 0).toISOString(),
	};

	test("JSON output is the update result carrying the task's real dates", async () => {
		const client = createMockClient();
		(client.updateTask as Mock).mockImplementation(() =>
			Promise.resolve(
				successResponse({
					id: moved.id,
					changes: ["due: tomorrow → 2026-09-03T18:00"],
					task: moved,
				}),
			),
		);
		const { stdout, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "move", "Buy milk", "tomorrow", "--json"],
			client,
		);
		const parsed = JSON.parse(stdout.join("\n"));
		expect(parsed.task.dueDate).toBe(moved.dueDate);
		expect(parsed.changes).toEqual(["due: tomorrow → 2026-09-03T18:00"]);
		expect(exitCode).toBeUndefined();
	});

	test("human output lists every set date in planned, defer, due order", async () => {
		assignShortIds([moved.id]);
		const client = createMockClient();
		const withAll = { ...moved, plannedDate: new Date(2026, 8, 2, 9, 0).toISOString() };
		(client.updateTask as Mock).mockImplementation(() =>
			Promise.resolve(successResponse({ id: moved.id, changes: [], task: withAll })),
		);
		const result = await withEnv({ NO_COLOR: "1" }, () =>
			withStreamTTY(process.stdout, true, () =>
				runCommand(registerTaskCommands, ["task", "move", "1", "tomorrow"], client),
			),
		);
		const [header, ...lines] = result.stdout;
		expect(header).toBe(`✓ Moved: ${moved.name} (1)`);
		expect(lines).toHaveLength(3);
		expect(lines[0]).toMatch(/^ {2}. Planned: .*2026/);
		expect(lines[1]).toMatch(/^ {2}. Defer: .*2026/);
		expect(lines[2]).toMatch(/^ {2}. Due: .*2026/);
		expect(result.exitCode).toBeUndefined();
	});

	test("human output omits dates that are unset and untouched", async () => {
		const client = createMockClient();
		(client.updateTask as Mock).mockImplementation(() =>
			Promise.resolve(
				successResponse({ id: moved.id, changes: [], task: { ...moved, deferDate: null } }),
			),
		);
		const result = await withEnv({ NO_COLOR: "1" }, () =>
			withStreamTTY(process.stdout, true, () =>
				runCommand(registerTaskCommands, ["task", "move", "Buy milk", "tomorrow"], client),
			),
		);
		const text = result.stdout.join("\n");
		expect(text).toContain("Due:");
		expect(text).not.toContain("Defer:");
		expect(text).not.toContain("Planned:");
	});

	test("human output highlights touched dates and dims the rest", async () => {
		const client = createMockClient();
		(client.updateTask as Mock).mockImplementation(() =>
			Promise.resolve(successResponse({ id: moved.id, changes: [], task: moved })),
		);
		const result = await withEnv({ NO_COLOR: undefined, FORCE_COLOR: "1" }, () =>
			withStreamTTY(process.stdout, true, () =>
				runCommand(registerTaskCommands, ["task", "move", "Buy milk", "tomorrow"], client),
			),
		);
		const [, deferLine, dueLine] = result.stdout;
		// Touched: green marker + green label/value.
		expect(dueLine).toContain("\x1b[32m●");
		expect(dueLine).toContain("\x1b[32mDue: ");
		// Untouched: dim bullet and dim label/value, no green.
		expect(deferLine).toContain("\x1b[2m•");
		expect(deferLine).toContain("\x1b[2mDefer: ");
		expect(deferLine).not.toContain("\x1b[32m");
	});

	test("human output says when a date was cleared", async () => {
		const client = createMockClient();
		(client.updateTask as Mock).mockImplementation(() =>
			Promise.resolve(
				successResponse({ id: MOCK_TASK.id, changes: [], task: { ...MOCK_TASK, dueDate: null } }),
			),
		);
		const result = await withEnv({ NO_COLOR: "1" }, () =>
			withStreamTTY(process.stdout, true, () =>
				runCommand(registerTaskCommands, ["task", "move", "Buy milk", "clear"], client),
			),
		);
		expect(result.stdout.join("\n")).toMatch(/Due:.*cleared/);
	});

	test("an unparseable date is reported on stderr with exit 1", async () => {
		const client = createMockClient();
		(client.updateTask as Mock).mockImplementation(() =>
			Promise.resolve(errorResponse('Could not understand date "junk"')),
		);
		const { stderr, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "move", "Buy milk", "junk", "--json"],
			client,
		);
		expect(exitCode).toBe(1);
		expect(JSON.parse(stderr.join("\n"))).toMatchObject({
			ok: false,
			error: 'Could not understand date "junk"',
		});
	});
});
