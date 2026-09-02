/**
 * `of task complete` / `of t complete` (alias) — multi-reference completion.
 * There is no root-level shortcut. Mock client only; no OmniFocus required.
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

function completed(id: string, name: string) {
	return successResponse({ id, name, action: "completed", task: { ...MOCK_TASK, id, name } });
}

let cacheDir: string;

beforeEach(() => {
	cacheDir = mkdtempSync(join(tmpdir(), "of-cli-complete-"));
	process.env.OF_SHORT_ID_CACHE = join(cacheDir, "short-ids.json");
});

afterEach(() => {
	rmSync(cacheDir, { recursive: true, force: true });
});

describe("registration", () => {
	test("complete lives under task only, never at the root", () => {
		const program = buildProgram(createMockClient());
		expect(program.commands.map((c) => c.name())).not.toContain("complete");
		const task = program.commands.find((c) => c.name() === "task");
		expect(task?.commands.map((c) => c.name())).toContain("complete");
	});

	test("`of t complete 1` resolves the short id and completes the task", async () => {
		assignShortIds(["ofIdAAAAAAA"]);
		const { client } = await runCommand(registerTaskCommands, ["t", "complete", "1", "--json"]);
		expect(client.completeTask).toHaveBeenCalledTimes(1);
		const [query, opts] = (client.completeTask as Mock).mock.calls[0] as [string, { id?: string }];
		expect(query).toBe("1");
		expect(opts.id).toBe("ofIdAAAAAAA");
	});

	test("`of task complete --incomplete` reopens like `task complete`", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"complete",
			"Buy milk",
			"--incomplete",
			"--json",
		]);
		const [, opts] = (client.completeTask as Mock).mock.calls[0] as [
			string,
			{ incomplete?: boolean },
		];
		expect(opts.incomplete).toBe(true);
	});
});

describe("single reference (backward compatible)", () => {
	test("JSON output is the bare result object", async () => {
		const { stdout, exitCode } = await runCommand(registerTaskCommands, [
			"task",
			"complete",
			"Buy milk",
			"--json",
		]);
		const parsed = JSON.parse(stdout.join("\n"));
		expect(Array.isArray(parsed)).toBe(false);
		expect(parsed).toMatchObject({ id: MOCK_TASK.id, action: "completed" });
		expect(exitCode).toBeUndefined();
	});

	test("a bridge error is reported on stderr and exits 1", async () => {
		const client = createMockClient();
		(client.completeTask as Mock).mockImplementation(() =>
			Promise.resolve(errorResponse("Task not found: nope")),
		);
		const { stderr, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "complete", "nope", "--json"],
			client,
		);
		expect(exitCode).toBe(1);
		expect(JSON.parse(stderr.join("\n"))).toMatchObject({
			ok: false,
			error: "Task not found: nope",
		});
	});
});

describe("multiple references", () => {
	test("completes each reference in order with one client call each", async () => {
		assignShortIds(["ofIdAAAAAAA", "ofIdBBBBBBB"]);
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"complete",
			"1",
			"2",
			"Call mom",
			"--json",
		]);
		const calls = (client.completeTask as Mock).mock.calls as [string, { id?: string }][];
		expect(calls).toHaveLength(3);
		expect(calls[0]?.[1].id).toBe("ofIdAAAAAAA");
		expect(calls[1]?.[1].id).toBe("ofIdBBBBBBB");
		expect(calls[2]?.[0]).toBe("Call mom");
		expect(calls[2]?.[1].id).toBeUndefined();
	});

	test("JSON output is an array of per-reference results", async () => {
		const client = createMockClient();
		(client.completeTask as Mock)
			.mockImplementationOnce(() => Promise.resolve(completed("idA", "Task A")))
			.mockImplementationOnce(() => Promise.resolve(completed("idB", "Task B")));
		const { stdout, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "complete", "Task A", "Task B", "--json"],
			client,
		);
		const parsed = JSON.parse(stdout.join("\n"));
		expect(parsed).toEqual([
			expect.objectContaining({ ref: "Task A", ok: true, id: "idA", action: "completed" }),
			expect.objectContaining({ ref: "Task B", ok: true, id: "idB", action: "completed" }),
		]);
		expect(exitCode).toBeUndefined();
	});

	test("a failing reference does not stop the others and exits 1", async () => {
		const client = createMockClient();
		(client.completeTask as Mock)
			.mockImplementationOnce(() => Promise.resolve(completed("idA", "Task A")))
			.mockImplementationOnce(() =>
				Promise.resolve(errorResponse("Multiple tasks match", ["Task B1", "Task B2"])),
			)
			.mockImplementationOnce(() => Promise.resolve(completed("idC", "Task C")));
		const { stdout, exitCode } = await runCommand(
			registerTaskCommands,
			["task", "complete", "Task A", "Task B", "Task C", "--json"],
			client,
		);
		expect(client.completeTask).toHaveBeenCalledTimes(3);
		const parsed = JSON.parse(stdout.join("\n"));
		expect(parsed).toHaveLength(3);
		expect(parsed[1]).toEqual({
			ref: "Task B",
			ok: false,
			error: "Multiple tasks match",
			candidates: ["Task B1", "Task B2"],
		});
		expect(parsed[2]).toMatchObject({ ref: "Task C", ok: true });
		expect(exitCode).toBe(1);
	});

	test("human mode prints one confirmation line per task and errors on stderr", async () => {
		const client = createMockClient();
		(client.completeTask as Mock)
			.mockImplementationOnce(() => Promise.resolve(completed("idA", "Task A")))
			.mockImplementationOnce(() => Promise.resolve(errorResponse("Task not found: zzz")))
			.mockImplementationOnce(() => Promise.resolve(completed("idC", "Task C")));
		const result = await withEnv({ NO_COLOR: "1" }, () =>
			withStreamTTY(process.stdout, true, () =>
				withStreamTTY(process.stderr, true, () =>
					runCommand(registerTaskCommands, ["task", "complete", "Task A", "zzz", "Task C"], client),
				),
			),
		);
		expect(result.stdout).toEqual(["✓ Completed: Task A", "✓ Completed: Task C"]);
		expect(result.stderr.join("\n")).toContain("Task not found: zzz");
		expect(result.exitCode).toBe(1);
	});

	test("--id is rejected when more than one reference is given", async () => {
		const { client, stderr, exitCode } = await runCommand(registerTaskCommands, [
			"task",
			"complete",
			"a",
			"b",
			"--id",
			"explicit",
			"--json",
		]);
		expect(client.completeTask).not.toHaveBeenCalled();
		expect(exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("--id");
	});
});
