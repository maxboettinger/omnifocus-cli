/**
 * Integration tests — verify CLI commands parse correctly and call
 * the right client methods with the right arguments.
 *
 * These mock the OmniFocusClient to test the full command → service → output flow
 * without requiring OmniFocus to be running.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { Command } from "commander";
import { registerCollectCommand } from "../../src/commands/collect.js";
import { registerCompletionCommand } from "../../src/commands/completion.js";
import { registerFolderCommands } from "../../src/commands/folder/index.js";
import { registerForecastCommand } from "../../src/commands/forecast.js";
import { registerInboxCommands } from "../../src/commands/inbox/index.js";
import { registerProjectCommands } from "../../src/commands/project/index.js";
import { registerStatsCommand } from "../../src/commands/stats.js";
import { registerTagCommands } from "../../src/commands/tag/index.js";
import { registerTaskCommands } from "../../src/commands/task/index.js";
import { assignShortIds } from "../../src/core/short-ids.js";
import type { OmniFocusClient } from "../../src/core/types.js";
import { createMockClient } from "../fixtures/mock-client.js";
import { MOCK_TASK, successResponse } from "../fixtures/mock-responses.js";

// ── Helper: run a command and capture output ────────────────────────────────

async function runCommand(
	setup: (program: Command, client: OmniFocusClient) => void,
	argv: string[],
	client?: OmniFocusClient,
): Promise<{ client: OmniFocusClient; stdout: string[]; stderr: string[] }> {
	const c = client ?? createMockClient();
	const program = new Command();
	program.name("of").exitOverride();
	setup(program, c);

	const stdout: string[] = [];
	const stderr: string[] = [];
	const origLog = console.log;
	const origErr = console.error;
	console.log = (...args: unknown[]) => {
		stdout.push(args.map(String).join(" "));
	};
	console.error = (...args: unknown[]) => {
		stderr.push(args.map(String).join(" "));
	};
	try {
		await program.parseAsync(argv, { from: "user" });
	} finally {
		console.log = origLog;
		console.error = origErr;
	}
	return { client: c, stdout, stderr };
}

async function runCommandWithStdin(
	setup: (program: Command, client: OmniFocusClient) => void,
	argv: string[],
	stdinInput: string,
	client?: OmniFocusClient,
): Promise<{ client: OmniFocusClient; stdout: string[]; stderr: string[] }> {
	const originalStdin = process.stdin;
	const mockStdin = Readable.from([Buffer.from(stdinInput)]);
	Object.defineProperty(process, "stdin", {
		value: mockStdin,
		configurable: true,
	});
	try {
		return await runCommand(setup, argv, client);
	} finally {
		Object.defineProperty(process, "stdin", {
			value: originalStdin,
			configurable: true,
		});
	}
}

// ── Task commands ───────────────────────────────────────────────────────────

describe("task commands", () => {
	test("task add calls createTask with correct args", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"add",
			"Buy groceries",
			"--due",
			"2026-03-05",
			"--flag",
			"--tag",
			"errand",
			"--json",
		]);
		expect(client.createTask).toHaveBeenCalledTimes(1);
		const call = (client.createTask as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({
			name: "Buy groceries",
			due: "2026-03-05",
			flag: true,
			tags: ["errand"],
		});
	});

	test("task list calls listTasks with filter", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"list",
			"--filter",
			"flagged",
			"--limit",
			"10",
			"--json",
		]);
		expect(client.listTasks).toHaveBeenCalledTimes(1);
		const call = (client.listTasks as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ filter: "flagged", limit: 10, includeNotifications: true });
	});

	test("task complete calls completeTask", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"complete",
			"Buy groceries",
			"--json",
		]);
		expect(client.completeTask).toHaveBeenCalledTimes(1);
	});

	test("task search calls searchTasks", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"search",
			"groceries",
			"--limit",
			"25",
			"--json",
		]);
		expect(client.searchTasks).toHaveBeenCalledTimes(1);
		const call = (client.searchTasks as ReturnType<typeof mock>).mock.calls[0] as [string, number];
		expect(call[0]).toBe("groceries");
		expect(call[1]).toBe(25);
	});

	test("task show calls getTask", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"show",
			"Buy groceries",
			"--json",
		]);
		expect(client.getTask).toHaveBeenCalledTimes(1);
		const call = (client.getTask as ReturnType<typeof mock>).mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		expect(call[1]).toMatchObject({ includeNotifications: true });
	});

	test("task notification list calls listTaskNotifications", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"notification",
			"list",
			"--id",
			"task-abc123",
			"--json",
		]);
		expect(client.listTaskNotifications).toHaveBeenCalledTimes(1);
		const call = (client.listTaskNotifications as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ id: "task-abc123" });
	});

	test("task notification add calls addTaskNotification", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"notification",
			"add",
			"--id",
			"task-abc123",
			"--kind",
			"absolute",
			"--at",
			"2026-03-05T09:00",
			"--repeat",
			"1h",
			"--json",
		]);
		expect(client.addTaskNotification).toHaveBeenCalledTimes(1);
		const call = (client.addTaskNotification as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({
			id: "task-abc123",
			kind: "absolute",
			at: "2026-03-05T09:00",
			repeatSeconds: 3600,
		});
	});

	test("task notification update calls updateTaskNotification", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"notification",
			"update",
			"--id",
			"task-abc123",
			"--notification-id",
			"notif-1",
			"--repeat",
			"clear",
			"--json",
		]);
		expect(client.updateTaskNotification).toHaveBeenCalledTimes(1);
		const call = (client.updateTaskNotification as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({
			id: "task-abc123",
			notificationId: "notif-1",
			repeatSeconds: "clear",
		});
	});

	test("task notification delete calls deleteTaskNotification", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"notification",
			"delete",
			"--id",
			"task-abc123",
			"--notification-id",
			"notif-1",
			"--json",
		]);
		expect(client.deleteTaskNotification).toHaveBeenCalledTimes(1);
		const call = (client.deleteTaskNotification as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({
			id: "task-abc123",
			notificationId: "notif-1",
		});
	});

	test("task notification clear calls clearTaskNotifications", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"notification",
			"clear",
			"--id",
			"task-abc123",
			"--confirm",
			"--json",
		]);
		expect(client.clearTaskNotifications).toHaveBeenCalledTimes(1);
		const call = (client.clearTaskNotifications as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ id: "task-abc123", confirm: true });
	});

	test("task notification add validates kind-specific required fields", async () => {
		const c = createMockClient();
		const origExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as never;
		try {
			await runCommand(
				registerTaskCommands,
				["task", "notification", "add", "--kind", "absolute", "--json"],
				c,
			);
			expect(c.addTaskNotification).not.toHaveBeenCalled();
			expect(exitCode).toBe(1);
		} finally {
			process.exit = origExit;
		}
	});

	test("task notification clear requires --confirm", async () => {
		const c = createMockClient();
		const origExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as never;
		try {
			await runCommand(
				registerTaskCommands,
				["task", "notification", "clear", "--id", "task-abc123", "--json"],
				c,
			);
			expect(c.clearTaskNotifications).not.toHaveBeenCalled();
			expect(exitCode).toBe(1);
		} finally {
			process.exit = origExit;
		}
	});

	test("task notification update requires at least one mutation flag", async () => {
		const c = createMockClient();
		const origExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as never;
		try {
			await runCommand(
				registerTaskCommands,
				[
					"task",
					"notification",
					"update",
					"--id",
					"task-abc123",
					"--notification-id",
					"notif-1",
					"--json",
				],
				c,
			);
			expect(c.updateTaskNotification).not.toHaveBeenCalled();
			expect(exitCode).toBe(1);
		} finally {
			process.exit = origExit;
		}
	});

	test("task update with --id calls updateTask", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"update",
			"--id",
			"abc123",
			"--due",
			"2026-04-01",
			"--json",
		]);
		expect(client.updateTask).toHaveBeenCalledTimes(1);
		const call = (client.updateTask as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ id: "abc123", due: "2026-04-01" });
	});

	test("task add in human mode surfaces partial-apply warnings", async () => {
		const originalIsTTY = process.stdout.isTTY;
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			configurable: true,
		});

		try {
			const c = createMockClient();
			c.createTask = mock(() =>
				Promise.resolve(
					successResponse({
						id: MOCK_TASK.id,
						name: MOCK_TASK.name,
						task: MOCK_TASK,
						warnings: ['tag failed (missing): Tag not found: "missing"'],
					}),
				),
			);
			const { stderr } = await runCommand(
				registerTaskCommands,
				["task", "add", "Buy groceries"],
				c,
			);
			expect(stderr.some((line) => line.includes("Partial apply warning:"))).toBeTrue();
		} finally {
			Object.defineProperty(process.stdout, "isTTY", {
				value: originalIsTTY,
				configurable: true,
			});
		}
	});
});

// ── Project commands ────────────────────────────────────────────────────────

describe("project commands", () => {
	test("project add calls createProject", async () => {
		const { client } = await runCommand(registerProjectCommands, [
			"project",
			"add",
			"Home Reno",
			"--sequential",
			"--folder",
			"Personal",
			"--json",
		]);
		expect(client.createProject).toHaveBeenCalledTimes(1);
		const call = (client.createProject as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ name: "Home Reno", sequential: true, folder: "Personal" });
	});

	test("project list calls listProjects", async () => {
		const { client } = await runCommand(registerProjectCommands, [
			"project",
			"list",
			"--status",
			"active",
			"--json",
		]);
		expect(client.listProjects).toHaveBeenCalledTimes(1);
	});

	test("project delete requires --confirm", async () => {
		const c = createMockClient();
		// With --confirm, deleteProject should be called.
		await runCommand(
			registerProjectCommands,
			["project", "delete", "Old Project", "--confirm", "--json"],
			c,
		);
		expect(c.deleteProject).toHaveBeenCalledTimes(1);
	});
});

// ── Tag commands ────────────────────────────────────────────────────────────

describe("tag commands", () => {
	test("tag add calls createTag", async () => {
		const { client } = await runCommand(registerTagCommands, ["tag", "add", "urgent", "--json"]);
		expect(client.createTag).toHaveBeenCalledTimes(1);
		const call = (client.createTag as ReturnType<typeof mock>).mock.calls[0] as [string];
		expect(call[0]).toBe("urgent");
	});

	test("tag tasks calls listTasksByTag", async () => {
		const { client } = await runCommand(registerTagCommands, ["tag", "tasks", "errand", "--json"]);
		expect(client.listTasksByTag).toHaveBeenCalledTimes(1);
	});
});

// ── Folder commands ─────────────────────────────────────────────────────────

describe("folder commands", () => {
	test("folder add calls createFolder", async () => {
		const { client } = await runCommand(registerFolderCommands, [
			"folder",
			"add",
			"Personal",
			"--parent",
			"Life",
			"--json",
		]);
		expect(client.createFolder).toHaveBeenCalledTimes(1);
		const call = (client.createFolder as ReturnType<typeof mock>).mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		expect(call[0]).toBe("Personal");
		expect(call[1]).toMatchObject({ parent: "Life" });
	});
});

// ── Inbox commands ──────────────────────────────────────────────────────────

describe("inbox commands", () => {
	test("inbox add in human mode does not print undefined", async () => {
		const originalIsTTY = process.stdout.isTTY;
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			configurable: true,
		});

		try {
			const { stdout } = await runCommand(registerInboxCommands, ["inbox", "add", "Quick note"]);
			expect(stdout.some((line) => line.includes("undefined"))).toBeFalse();
		} finally {
			Object.defineProperty(process.stdout, "isTTY", {
				value: originalIsTTY,
				configurable: true,
			});
		}
	});

	test("inbox process-many calls processInbox for each stdin item", async () => {
		const c = createMockClient();
		await runCommandWithStdin(
			registerInboxCommands,
			["inbox", "process-many", "--json"],
			JSON.stringify([
				{ id: "inbox-1", project: "Errands", tags: ["errand"] },
				{ id: "inbox-2", complete: true },
			]),
			c,
		);

		expect(c.processInbox).toHaveBeenCalledTimes(2);
		const calls = (c.processInbox as ReturnType<typeof mock>).mock.calls as [
			Record<string, unknown>,
		][];
		expect(calls).toHaveLength(2);
		const firstCall = calls.at(0);
		const secondCall = calls.at(1);
		if (!firstCall || !secondCall) {
			throw new Error("Expected exactly two processInbox calls");
		}
		expect(firstCall[0]).toMatchObject({
			id: "inbox-1",
			project: "Errands",
			tags: ["errand"],
		});
		expect(secondCall[0]).toMatchObject({ id: "inbox-2", complete: true });
		// confirm provenance is the --confirm flag only; without it every item is forced false.
		expect(firstCall[0].confirm).toBe(false);
		expect(secondCall[0].confirm).toBe(false);
	});

	test("inbox list defaults to a limit of 50", async () => {
		const c = createMockClient();
		await runCommand(registerInboxCommands, ["inbox", "list", "--json"], c);
		expect(c.listInbox).toHaveBeenCalledWith(50, { newestFirst: undefined });
	});

	test("inbox list passes --newest-first through to the client", async () => {
		const c = createMockClient();
		await runCommand(registerInboxCommands, ["inbox", "list", "--newest-first", "--json"], c);
		expect(c.listInbox).toHaveBeenCalledWith(50, { newestFirst: true });
	});

	test("inbox list warns on stderr when the limit is filled", async () => {
		const c = createMockClient();
		const tasks = [MOCK_TASK, { ...MOCK_TASK, id: "task-2" }];
		(c.listInbox as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(successResponse(tasks)),
		);
		const { stdout, stderr } = await runCommand(
			registerInboxCommands,
			["inbox", "list", "--limit", "2", "--json"],
			c,
		);
		// stdout stays a clean JSON array; the notice goes to stderr
		expect(JSON.parse(stdout.join("\n"))).toHaveLength(2);
		expect(stderr.some((line) => line.includes("--limit"))).toBeTrue();
	});

	test("inbox list prints no limit notice when results are under the limit", async () => {
		const { stderr } = await runCommand(registerInboxCommands, [
			"inbox",
			"list",
			"--limit",
			"5",
			"--json",
		]);
		expect(stderr).toHaveLength(0);
	});

	test("inbox process --delete without --confirm exits with error", async () => {
		const c = createMockClient();
		const origExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as never;
		try {
			const { stderr } = await runCommand(
				registerInboxCommands,
				["inbox", "process", "inbox-1", "--delete"],
				c,
			);
			expect(c.processInbox).not.toHaveBeenCalled();
			expect(exitCode).toBe(1);
			expect(stderr.some((line) => line.includes("--confirm"))).toBeTrue();
		} finally {
			process.exit = origExit;
		}
	});

	test("inbox process --delete --confirm calls processInbox with confirm: true", async () => {
		const { client } = await runCommand(registerInboxCommands, [
			"inbox",
			"process",
			"inbox-1",
			"--delete",
			"--confirm",
			"--json",
		]);
		expect(client.processInbox).toHaveBeenCalledTimes(1);
		const call = (client.processInbox as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ id: "inbox-1", delete: true, confirm: true });
	});

	test("inbox process --delete --dry-run without --confirm still calls processInbox", async () => {
		const { client } = await runCommand(registerInboxCommands, [
			"inbox",
			"process",
			"inbox-1",
			"--delete",
			"--dry-run",
			"--json",
		]);
		expect(client.processInbox).toHaveBeenCalledTimes(1);
		const call = (client.processInbox as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ id: "inbox-1", delete: true, dryRun: true });
	});

	test("inbox process-many with delete item and no --confirm exits with error", async () => {
		const c = createMockClient();
		const origExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as never;
		try {
			const { stderr } = await runCommandWithStdin(
				registerInboxCommands,
				["inbox", "process-many"],
				JSON.stringify([
					{ id: "inbox-1", project: "Errands" },
					{ id: "inbox-2", delete: true },
				]),
				c,
			);
			expect(c.processInbox).not.toHaveBeenCalled();
			expect(exitCode).toBe(1);
			expect(stderr.some((line) => line.includes("--confirm"))).toBeTrue();
		} finally {
			process.exit = origExit;
		}
	});

	test("inbox process-many with delete item and --confirm processes items", async () => {
		const c = createMockClient();
		await runCommandWithStdin(
			registerInboxCommands,
			["inbox", "process-many", "--confirm", "--json"],
			JSON.stringify([
				{ id: "inbox-1", project: "Errands" },
				{ id: "inbox-2", delete: true },
			]),
			c,
		);

		expect(c.processInbox).toHaveBeenCalledTimes(2);
		const calls = (c.processInbox as ReturnType<typeof mock>).mock.calls as [
			Record<string, unknown>,
		][];
		// Every item's confirm is overwritten from the --confirm flag, regardless of
		// whether that item itself has delete: true.
		expect(calls[0]?.[0]).toMatchObject({ id: "inbox-1", project: "Errands", confirm: true });
		expect(calls[1]?.[0]).toMatchObject({ id: "inbox-2", delete: true, confirm: true });
	});

	test("inbox process-many stdin delete:1 with confirm:true bypass attempt is blocked without --confirm", async () => {
		const c = createMockClient();
		const origExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as never;
		try {
			const { stderr } = await runCommandWithStdin(
				registerInboxCommands,
				["inbox", "process-many"],
				JSON.stringify([{ id: "x", delete: 1, confirm: true }]),
				c,
			);
			expect(c.processInbox).not.toHaveBeenCalled();
			expect(exitCode).toBe(1);
			expect(stderr.some((line) => line.includes("--confirm"))).toBeTrue();
		} finally {
			process.exit = origExit;
		}
	});

	test("inbox process-many strips stdin-supplied confirm when --confirm is not passed", async () => {
		const c = createMockClient();
		await runCommandWithStdin(
			registerInboxCommands,
			["inbox", "process-many", "--json"],
			JSON.stringify([{ id: "x", confirm: true, project: "Errands" }]),
			c,
		);

		expect(c.processInbox).toHaveBeenCalledTimes(1);
		const call = (c.processInbox as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0].confirm).not.toBe(true);
		expect(call[0]).toMatchObject({ id: "x", project: "Errands", confirm: false });
	});

	test("inbox process-many with --confirm forwards truthy non-boolean delete as confirm: true", async () => {
		const c = createMockClient();
		await runCommandWithStdin(
			registerInboxCommands,
			["inbox", "process-many", "--confirm", "--json"],
			JSON.stringify([{ id: "x", delete: 1 }]),
			c,
		);

		expect(c.processInbox).toHaveBeenCalledTimes(1);
		const call = (c.processInbox as ReturnType<typeof mock>).mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(call[0]).toMatchObject({ id: "x", delete: 1, confirm: true });
	});
});

describe("task list limit notice", () => {
	test("task list warns on stderr when the limit is filled", async () => {
		const c = createMockClient();
		(c.listTasks as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(successResponse([MOCK_TASK])),
		);
		const { stderr } = await runCommand(
			registerTaskCommands,
			["task", "list", "--limit", "1", "--json"],
			c,
		);
		expect(stderr.some((line) => line.includes("--limit"))).toBeTrue();
	});
});

// ── Task search limit notice ────────────────────────────────────────────────

describe("task search limit notice", () => {
	test("task search defaults to a limit of 50", async () => {
		const c = createMockClient();
		await runCommand(registerTaskCommands, ["task", "search", "test", "--json"], c);
		expect(c.searchTasks).toHaveBeenCalledWith("test", 50);
	});

	test("task search warns on stderr when the limit is filled", async () => {
		const c = createMockClient();
		const tasks = Array.from({ length: 50 }, (_, i) => ({
			...MOCK_TASK,
			id: `task-${i}`,
		}));
		(c.searchTasks as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(successResponse(tasks)),
		);
		const { stdout, stderr } = await runCommand(
			registerTaskCommands,
			["task", "search", "test", "--limit", "50", "--json"],
			c,
		);
		expect(JSON.parse(stdout.join("\n"))).toHaveLength(50);
		expect(stderr.some((line) => line.includes("--limit"))).toBeTrue();
	});

	test("task search prints no limit notice when results are under the limit", async () => {
		const { stderr } = await runCommand(registerTaskCommands, [
			"task",
			"search",
			"test",
			"--limit",
			"50",
			"--json",
		]);
		expect(stderr).toHaveLength(0);
	});
});

// ── Tag tasks limit notice ──────────────────────────────────────────────────

describe("tag tasks limit notice", () => {
	test("tag tasks defaults to a limit of 50", async () => {
		const c = createMockClient();
		await runCommand(registerTagCommands, ["tag", "tasks", "urgent", "--json"], c);
		expect(c.listTasksByTag).toHaveBeenCalledWith("urgent", 50);
	});

	test("tag tasks warns on stderr when the limit is filled", async () => {
		const c = createMockClient();
		const tasks = Array.from({ length: 50 }, (_, i) => ({
			...MOCK_TASK,
			id: `task-${i}`,
		}));
		(c.listTasksByTag as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(successResponse(tasks)),
		);
		const { stdout, stderr } = await runCommand(
			registerTagCommands,
			["tag", "tasks", "urgent", "--limit", "50", "--json"],
			c,
		);
		expect(JSON.parse(stdout.join("\n"))).toHaveLength(50);
		expect(stderr.some((line) => line.includes("--limit"))).toBeTrue();
	});

	test("tag tasks prints no limit notice when results are under the limit", async () => {
		const { stderr } = await runCommand(registerTagCommands, [
			"tag",
			"tasks",
			"urgent",
			"--limit",
			"50",
			"--json",
		]);
		expect(stderr).toHaveLength(0);
	});
});

// ── Stats command ───────────────────────────────────────────────────────────

describe("stats command", () => {
	test("stats calls client.stats()", async () => {
		const { client } = await runCommand(registerStatsCommand, ["stats", "--json"]);
		expect(client.stats).toHaveBeenCalledTimes(1);
	});
});

// ── Collect command ──────────────────────────────────────────────────────────

describe("collect command", () => {
	test("collect calls client.collectCompleted with default days", async () => {
		const { client } = await runCommand(registerCollectCommand, ["collect", "--json"]);
		expect(client.collectCompleted).toHaveBeenCalledTimes(1);
		const call = (client.collectCompleted as ReturnType<typeof mock>).mock.calls[0] as [
			number | undefined,
		];
		expect(call[0]).toBeUndefined();
	});

	test("collect passes --days option", async () => {
		const { client } = await runCommand(registerCollectCommand, [
			"collect",
			"--days",
			"14",
			"--json",
		]);
		expect(client.collectCompleted).toHaveBeenCalledTimes(1);
		const call = (client.collectCompleted as ReturnType<typeof mock>).mock.calls[0] as [
			number | undefined,
		];
		expect(call[0]).toBe(14);
	});
});

// ── Completion command ──────────────────────────────────────────────────────

describe("completion command", () => {
	test("fish completion gates notification verbs on exact task notification path", async () => {
		const { stdout } = await runCommand(
			(program: Command, client: OmniFocusClient) => {
				registerTaskCommands(program, client);
				registerCompletionCommand(program);
			},
			["completion", "fish"],
		);
		const script = stdout.join("\n");
		expect(script).toContain("function __of_seen_task_notification");
		expect(script).toContain('test "$cmd[2]" = "task"');
		expect(script).toContain('test "$cmd[3]" = "notification"');
		expect(script).toContain("complete -c of -n '__of_seen_task_notification' -a list -d '");
	});
});

// ── Task delete command ─────────────────────────────────────────────────────

describe("task delete command", () => {
	test("task delete with --confirm calls deleteTask", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"delete",
			"Buy groceries",
			"--confirm",
			"--json",
		]);
		expect(client.deleteTask).toHaveBeenCalledTimes(1);
		const call = (client.deleteTask as ReturnType<typeof mock>).mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		expect(call[0]).toBe("Buy groceries");
		expect(call[1]).toMatchObject({ confirm: true });
	});

	test("task delete with --id calls deleteTask with id", async () => {
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"delete",
			"Buy groceries",
			"--id",
			"task-abc123",
			"--confirm",
			"--json",
		]);
		expect(client.deleteTask).toHaveBeenCalledTimes(1);
		const call = (client.deleteTask as ReturnType<typeof mock>).mock.calls[0] as [
			string,
			Record<string, unknown>,
		];
		expect(call[1]).toMatchObject({ id: "task-abc123", confirm: true });
	});

	test("task delete without --confirm exits with error", async () => {
		const c = createMockClient();
		const origExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as never;
		try {
			const { stderr } = await runCommand(
				registerTaskCommands,
				["task", "delete", "Buy groceries"],
				c,
			);
			expect(c.deleteTask).not.toHaveBeenCalled();
			expect(exitCode).toBe(1);
			expect(stderr.some((line) => line.includes("--confirm"))).toBeTrue();
		} finally {
			process.exit = origExit;
		}
	});
});

// ── Short ID references ─────────────────────────────────────────────────────

describe("short id references", () => {
	let savedCachePath: string | undefined;
	let cachePath: string;
	const cacheDirs: string[] = [];

	beforeEach(() => {
		savedCachePath = process.env.OF_SHORT_ID_CACHE;
		const dir = mkdtempSync(join(tmpdir(), "of-cli-short-ids-"));
		cacheDirs.push(dir);
		cachePath = join(dir, "short-ids.json");
		process.env.OF_SHORT_ID_CACHE = cachePath;
	});

	afterEach(() => {
		process.env.OF_SHORT_ID_CACHE = savedCachePath;
		for (const dir of cacheDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	function seed(...ofIds: string[]): void {
		assignShortIds(ofIds, { cachePath });
	}

	function firstCall(fn: unknown): unknown[] {
		return (fn as ReturnType<typeof mock>).mock.calls[0] as unknown[];
	}

	test("task complete resolves a numeric short id to the OmniFocus id", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, ["task", "complete", "1", "--json"]);
		const [query, opts] = firstCall(client.completeTask);
		expect(query).toBe("1");
		expect((opts as Record<string, unknown>).id).toBe("ofIdAAAAAAA");
	});

	test("task complete leaves an unknown number as a name query", async () => {
		const { client } = await runCommand(registerTaskCommands, ["task", "complete", "99", "--json"]);
		const [query, opts] = firstCall(client.completeTask);
		expect(query).toBe("99");
		expect((opts as Record<string, unknown>).id).toBeUndefined();
	});

	test("task complete leaves a name query untouched", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"complete",
			"Buy milk",
			"--json",
		]);
		const [query, opts] = firstCall(client.completeTask);
		expect(query).toBe("Buy milk");
		expect((opts as Record<string, unknown>).id).toBeUndefined();
	});

	test("task complete lets an explicit --id win over the alias", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"complete",
			"1",
			"--id",
			"explicit-id",
			"--json",
		]);
		const [, opts] = firstCall(client.completeTask);
		expect((opts as Record<string, unknown>).id).toBe("explicit-id");
	});

	test("task update resolves a numeric short id", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"update",
			"1",
			"--name",
			"Renamed",
			"--json",
		]);
		const [opts] = firstCall(client.updateTask);
		expect(opts).toMatchObject({ query: "1", id: "ofIdAAAAAAA" });
	});

	test("task delete resolves a numeric short id", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"delete",
			"1",
			"--confirm",
			"--json",
		]);
		const [query, opts] = firstCall(client.deleteTask);
		expect(query).toBe("1");
		expect((opts as Record<string, unknown>).id).toBe("ofIdAAAAAAA");
	});

	test("task show resolves a numeric short id to a byId query", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, ["task", "show", "1", "--json"]);
		const [query] = firstCall(client.getTask);
		expect(query).toBe("ofIdAAAAAAA");
	});

	test("task tag resolves a numeric short id", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"tag",
			"1",
			"home",
			"--json",
		]);
		const [query, tags, opts] = firstCall(client.applyTag);
		expect(query).toBe("1");
		expect(tags).toEqual(["home"]);
		expect((opts as Record<string, unknown>).id).toBe("ofIdAAAAAAA");
	});

	test("task notification add resolves a numeric short id", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerTaskCommands, [
			"task",
			"notification",
			"add",
			"1",
			"--kind",
			"absolute",
			"--at",
			"2026-09-01 09:00",
			"--json",
		]);
		const [opts] = firstCall(client.addTaskNotification);
		expect(opts).toMatchObject({ query: "1", id: "ofIdAAAAAAA" });
	});

	test("inbox process resolves a numeric short id", async () => {
		seed("ofIdAAAAAAA");
		const { client } = await runCommand(registerInboxCommands, [
			"inbox",
			"process",
			"1",
			"--complete",
			"--json",
		]);
		const [opts] = firstCall(client.processInbox);
		expect((opts as Record<string, unknown>).id).toBe("ofIdAAAAAAA");
	});

	test("inbox process still accepts a raw OmniFocus id", async () => {
		const { client } = await runCommand(registerInboxCommands, [
			"inbox",
			"process",
			"ofIdRAW1234",
			"--complete",
			"--json",
		]);
		const [opts] = firstCall(client.processInbox);
		expect((opts as Record<string, unknown>).id).toBe("ofIdRAW1234");
	});
});

// ── Short ID display in human output ────────────────────────────────────────

describe("short id display", () => {
	let savedCachePath: string | undefined;
	let cachePath: string;
	const cacheDirs: string[] = [];

	beforeEach(() => {
		savedCachePath = process.env.OF_SHORT_ID_CACHE;
		const dir = mkdtempSync(join(tmpdir(), "of-cli-short-id-display-"));
		cacheDirs.push(dir);
		cachePath = join(dir, "short-ids.json");
		process.env.OF_SHORT_ID_CACHE = cachePath;
	});

	afterEach(() => {
		process.env.OF_SHORT_ID_CACHE = savedCachePath;
		for (const dir of cacheDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	async function runHuman(
		setup: (program: Command, client: OmniFocusClient) => void,
		argv: string[],
		client?: OmniFocusClient,
	): Promise<{ client: OmniFocusClient; stdout: string[]; stderr: string[] }> {
		const savedNoColor = process.env.NO_COLOR;
		process.env.NO_COLOR = "1";
		const original = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
		try {
			return await runCommand(setup, argv, client);
		} finally {
			if (original) Object.defineProperty(process.stdout, "isTTY", original);
			else Reflect.deleteProperty(process.stdout, "isTTY");
			if (savedNoColor === undefined) Reflect.deleteProperty(process.env, "NO_COLOR");
			else process.env.NO_COLOR = savedNoColor;
		}
	}

	test("forecast prefixes bucket tasks with short ids", async () => {
		const client = createMockClient();
		const payload = {
			meta: {
				generatedAt: "2026-08-31T08:00:00.000Z",
				today: "2026-08-31",
				upcomingDays: 3,
				totalEstimatedMinutes: 30,
				counts: {
					overdue: 1,
					dueToday: 1,
					plannedToday: 0,
					deferredToday: 0,
					flagged: 0,
					upcoming: 0,
					availableNext: 0,
				},
				dragAlerts: [],
			},
			overdue: [{ ...MOCK_TASK, id: "ofIdAAAAAAA", name: "Overdue thing", flagged: false }],
			due_today: [{ ...MOCK_TASK, id: "ofIdBBBBBBB", name: "Due thing", flagged: false }],
			planned_today: [],
			deferred_today: [],
			flagged: [],
			upcoming: [],
			available_next: [],
		};
		(client.forecast as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(successResponse(payload)),
		);
		const { stdout } = await runHuman(
			(program, c) => registerForecastCommand(program, c),
			["forecast"],
			client,
		);
		const text = stdout.join("\n");
		expect(text).toContain("  1  Overdue thing");
		expect(text).toContain("  2  Due thing");
	});

	test("collect prefixes completed tasks with short ids", async () => {
		const client = createMockClient();
		const payload = [
			{
				omnifocus_id: "ofIdAAAAAAA",
				name: "Done one",
				project: "P",
				completion_date: "2026-08-30T10:00:00.000Z",
				tags: [],
				estimated_minutes: null,
				note: "",
			},
			{
				omnifocus_id: "ofIdBBBBBBB",
				name: "Done two",
				project: "",
				completion_date: "2026-08-30T11:00:00.000Z",
				tags: [],
				estimated_minutes: null,
				note: "",
			},
		];
		(client.collectCompleted as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.resolve(successResponse(payload)),
		);
		const { stdout } = await runHuman(
			(program, c) => registerCollectCommand(program, c),
			["collect"],
			client,
		);
		expect(stdout[0]).toStartWith("1  Done one");
		expect(stdout[1]).toStartWith("2  Done two");
	});

	test("task complete confirmation shows an existing short id", async () => {
		assignShortIds([MOCK_TASK.id], { cachePath });
		const { stdout } = await runHuman(registerTaskCommands, ["task", "complete", "1"]);
		expect(stdout.join("\n")).toContain(`Completed: ${MOCK_TASK.name} (1)`);
	});

	test("task delete confirmation shows an existing short id but mints none", async () => {
		const { stdout } = await runHuman(registerTaskCommands, [
			"task",
			"delete",
			MOCK_TASK.name,
			"--confirm",
		]);
		// No alias existed, so none is shown (and none is minted for a deleted task).
		expect(stdout.join("\n")).toContain(`Deleted: ${MOCK_TASK.name}`);
		expect(stdout.join("\n")).not.toContain("(1)");
	});

	test("task update prints the task name, not the raw OmniFocus id", async () => {
		const { stdout } = await runHuman(registerTaskCommands, [
			"task",
			"update",
			MOCK_TASK.name,
			"--due",
			"2026-03-10",
		]);
		expect(stdout.join("\n")).toContain(`Updated task: ${MOCK_TASK.name}`);
		expect(stdout.join("\n")).not.toContain(`Updated task: ${MOCK_TASK.id}`);
	});
});
