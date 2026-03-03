/**
 * Integration tests — verify CLI commands parse correctly and call
 * the right client methods with the right arguments.
 *
 * These mock the OmniFocusClient to test the full command → service → output flow
 * without requiring OmniFocus to be running.
 */

import { describe, expect, mock, test } from "bun:test";
import { Readable } from "node:stream";
import { Command } from "commander";
import { registerCollectCommand } from "../../src/commands/collect.js";
import { registerCompletionCommand } from "../../src/commands/completion.js";
import { registerFolderCommands } from "../../src/commands/folder/index.js";
import { registerInboxCommands } from "../../src/commands/inbox/index.js";
import { registerProjectCommands } from "../../src/commands/project/index.js";
import { registerStatsCommand } from "../../src/commands/stats.js";
import { registerTagCommands } from "../../src/commands/tag/index.js";
import { registerTaskCommands } from "../../src/commands/task/index.js";
import type { OmniFocusClient } from "../../src/core/types.js";
import {
	MOCK_PROJECT,
	MOCK_STATS,
	MOCK_TASK,
	successResponse,
} from "../fixtures/mock-responses.js";

// ── Mock client factory ─────────────────────────────────────────────────────

function createMockClient(): OmniFocusClient {
	const mockNotification = (MOCK_TASK.notifications ?? [])[0] ?? {
		id: "notif-1",
		kind: "absolute" as const,
		absoluteFireDate: "2026-03-04T09:00:00.000Z",
		relativeFireOffsetSeconds: null,
		repeatIntervalSeconds: null,
		nextFireDate: null,
		initialFireDate: null,
		isSnoozed: false,
		usesFloatingTimeZone: false,
	};
	return {
		createTask: mock(() =>
			Promise.resolve(successResponse({ id: MOCK_TASK.id, name: MOCK_TASK.name, task: MOCK_TASK })),
		),
		getTask: mock(() => Promise.resolve(successResponse(MOCK_TASK))),
		updateTask: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_TASK.id, changes: ["due: 2026-03-10"], task: MOCK_TASK }),
			),
		),
		completeTask: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_TASK.id,
					name: MOCK_TASK.name,
					action: "completed",
					task: MOCK_TASK,
				}),
			),
		),
		listTasks: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),
		searchTasks: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),
		createSubtask: mock(() =>
			Promise.resolve(
				successResponse({
					id: "sub-1",
					name: "Sub task",
					task: MOCK_TASK,
					parent: { id: MOCK_TASK.id, name: MOCK_TASK.name, project: "Errands" },
				}),
			),
		),
		applyTag: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_TASK.id,
					name: MOCK_TASK.name,
					applied: ["urgent"],
					task: MOCK_TASK,
				}),
			),
		),
		deleteTask: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_TASK.id, name: MOCK_TASK.name, action: "deleted" }),
			),
		),
		listTaskNotifications: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					notifications: MOCK_TASK.notifications ?? [],
				}),
			),
		),
		addTaskNotification: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					notification: mockNotification,
					notifications: MOCK_TASK.notifications ?? [],
				}),
			),
		),
		updateTaskNotification: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					notification: mockNotification,
					notifications: MOCK_TASK.notifications ?? [],
				}),
			),
		),
		deleteTaskNotification: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					deletedId: "notif-1",
					notifications: [],
				}),
			),
		),
		clearTaskNotifications: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					cleared: 1,
					notifications: [],
				}),
			),
		),

		createProject: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_PROJECT.id, name: MOCK_PROJECT.name, project: MOCK_PROJECT }),
			),
		),
		getProject: mock(() =>
			Promise.resolve(
				successResponse({ ...MOCK_PROJECT, overdueCount: 0, completionPercentage: 33 }),
			),
		),
		listProjects: mock(() => Promise.resolve(successResponse(["Project A", "Project B"]))),
		updateProject: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_PROJECT.id,
					changes: ["status → onhold"],
					project: MOCK_PROJECT,
				}),
			),
		),
		renameProject: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_PROJECT.id,
					oldName: "Old",
					newName: "New",
					project: MOCK_PROJECT,
				}),
			),
		),
		deleteProject: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_PROJECT.id, name: MOCK_PROJECT.name, action: "deleted" }),
			),
		),

		createTag: mock(() => Promise.resolve(successResponse({ id: "tag-1", name: "urgent" }))),
		listTags: mock(() => Promise.resolve(successResponse(["urgent", "errand"]))),
		renameTag: mock(() => Promise.resolve(successResponse({ oldName: "old", newName: "new" }))),
		deleteTag: mock(() => Promise.resolve(successResponse({ name: "old", action: "deleted" }))),
		listTasksByTag: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),

		createFolder: mock(() =>
			Promise.resolve(successResponse({ id: "folder-1", name: "Personal", parentFolder: null })),
		),
		listFolders: mock(() => Promise.resolve(successResponse(["Personal", "Work"]))),

		listInbox: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),
		addInbox: mock(() =>
			Promise.resolve(successResponse({ id: MOCK_TASK.id, name: MOCK_TASK.name, task: MOCK_TASK })),
		),
		processInbox: mock(() =>
			Promise.resolve(
				successResponse({ id: "inbox-1", changes: ["moved to project"], task: MOCK_TASK }),
			),
		),

		forecast: mock(() => Promise.resolve(successResponse({} as never))),
		review: mock(() => Promise.resolve(successResponse({} as never))),
		stats: mock(() => Promise.resolve(successResponse(MOCK_STATS))),

		bulkCreate: mock(() => Promise.resolve(successResponse([]))),
		bulkUpdate: mock(() => Promise.resolve(successResponse([]))),
		bulkComplete: mock(() => Promise.resolve(successResponse([]))),

		collectCompleted: mock(() => Promise.resolve(successResponse([]))),
	};
}

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
			(program: Command, _client: OmniFocusClient) => registerCompletionCommand(program),
			["completion", "fish"],
		);
		const script = stdout.join("\n");
		expect(script).toContain("function __of_seen_task_notification");
		expect(script).toContain('test "$cmd[2]" = "task"');
		expect(script).toContain('test "$cmd[3]" = "notification"');
		expect(script).toContain(
			"complete -c of -n '__of_seen_task_notification' -a list -d 'List task notifications'",
		);
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
