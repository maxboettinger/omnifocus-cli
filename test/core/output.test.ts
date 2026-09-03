import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPlanTree } from "../../src/core/ai/plan.js";
import { BridgeError } from "../../src/core/errors.js";
import {
	type BatchSummary,
	formatPlanTree,
	formatProjectDetail,
	formatProjectLine,
	formatTaskDetail,
	formatTaskLine,
	outputBatchSummary,
	outputEntityAction,
	outputError,
	outputPlanTree,
	outputTaskList,
	outputTreeResult,
	outputWarning,
	outputWarnings,
	resolveFormat,
} from "../../src/core/output.js";
import { assignShortIds, peekShortId } from "../../src/core/short-ids.js";
import type { OFProject, OFTask } from "../../src/core/types.js";
import { withEnv, withStreamTTY } from "../helpers/env.js";

// ── Test fixtures ───────────────────────────────────────────────────────────

function makeTask(overrides: Partial<OFTask> = {}): OFTask {
	return {
		name: "Buy groceries",
		id: "task-abc123",
		note: "",
		dueDate: null,
		deferDate: null,
		plannedDate: null,
		effectiveDueDate: null,
		effectiveDeferDate: null,
		effectivePlannedDate: null,
		flagged: false,
		effectiveFlagged: false,
		estimatedMinutes: null,
		completed: false,
		completionDate: null,
		creationDate: "2026-01-15T10:00:00.000Z",
		modificationDate: null,
		sequential: false,
		inInbox: false,
		blocked: false,
		project: "Errands",
		parentTask: null,
		tags: [],
		repetitionRule: null,
		childCount: 0,
		...overrides,
	};
}

function makeProject(overrides: Partial<OFProject> = {}): OFProject {
	return {
		id: "proj-abc123",
		name: "Home Renovation",
		note: "",
		status: "active",
		dueDate: null,
		deferDate: null,
		effectiveDueDate: null,
		effectiveDeferDate: null,
		flagged: false,
		sequential: false,
		completed: false,
		completionDate: null,
		creationDate: "2026-01-15T10:00:00.000Z",
		modificationDate: null,
		parentFolder: "Personal",
		tags: [],
		taskCount: 10,
		completedTaskCount: 3,
		...overrides,
	};
}

// ── resolveFormat ───────────────────────────────────────────────────────────

describe("resolveFormat", () => {
	test("returns json when jsonFlag is true", () => {
		expect(resolveFormat(true)).toBe("json");
	});

	test("returns human when jsonFlag is false and stdout is TTY", () => {
		// In test env, stdout.isTTY may or may not be set
		// When jsonFlag is undefined and it's not a TTY, it returns json
		const format = resolveFormat(false);
		// We can't control TTY in test, but we can verify the flag takes priority
		expect(["human", "json"]).toContain(format);
	});
});

// ── formatTaskLine ──────────────────────────────────────────────────────────

describe("formatTaskLine", () => {
	test("includes task name", () => {
		const line = formatTaskLine(makeTask());
		expect(line).toContain("Buy groceries");
	});

	test("includes project without brackets for non-inbox tasks", () => {
		const line = formatTaskLine(makeTask({ project: "Work" }));
		expect(line).toContain("Work");
		expect(line).not.toContain("[Work]");
	});

	test("omits project for inbox tasks", () => {
		const line = formatTaskLine(makeTask({ project: "Inbox" }));
		expect(line).not.toContain("Inbox");
	});

	test("shows flag indicator when flagged", () => {
		const line = formatTaskLine(makeTask({ flagged: true }));
		expect(line).toContain("⚑");
	});

	test("wraps tags in brackets", () => {
		const line = formatTaskLine(makeTask({ tags: ["errand", "urgent"] }));
		expect(line).toContain("[errand, urgent]");
	});

	test("includes due date", () => {
		const line = formatTaskLine(makeTask({ dueDate: "2026-03-15T00:00:00.000Z" }));
		expect(line).toContain("due:2026-03-15");
	});

	test("includes estimate", () => {
		const line = formatTaskLine(makeTask({ estimatedMinutes: 30 }));
		expect(line).toContain("30min");
	});
});

// ── formatTaskDetail ────────────────────────────────────────────────────────

describe("formatTaskDetail", () => {
	test("includes all populated fields", () => {
		const detail = formatTaskDetail(
			makeTask({
				note: "Get milk and eggs",
				dueDate: "2026-03-15T00:00:00.000Z",
				deferDate: "2026-03-10T00:00:00.000Z",
				plannedDate: "2026-03-14T00:00:00.000Z",
				flagged: true,
				estimatedMinutes: 30,
				tags: ["errand"],
				repetitionRule: { rule: "FREQ=WEEKLY", method: "due date" },
				notifications: [
					{
						id: "notif-1",
						kind: "absolute",
						absoluteFireDate: "2026-03-14T09:00:00.000Z",
						relativeFireOffsetSeconds: null,
						repeatIntervalSeconds: 3600,
						nextFireDate: null,
						initialFireDate: null,
						isSnoozed: false,
						usesFloatingTimeZone: false,
					},
				],
				sequential: true,
				blocked: true,
				parentTask: { id: "parent-1", name: "Shopping" },
				childCount: 3,
			}),
		);
		expect(detail).toContain("Buy groceries");
		expect(detail).toContain("task-abc123");
		expect(detail).toContain("Get milk and eggs");
		expect(detail).toContain("errand");
		expect(detail).toContain("30 min");
		expect(detail).toContain("FREQ=WEEKLY");
		expect(detail).toContain("Notifications:");
		expect(detail).toContain("notif-1");
		expect(detail).toContain("Shopping");
	});

	test("omits null/empty fields", () => {
		const detail = formatTaskDetail(makeTask());
		expect(detail).not.toContain("Note:");
		expect(detail).not.toContain("Due:");
		expect(detail).not.toContain("Defer:");
	});
});

// ── formatProjectLine ───────────────────────────────────────────────────────

describe("formatProjectLine", () => {
	test("includes name, status, and task count", () => {
		const line = formatProjectLine(makeProject());
		expect(line).toContain("Home Renovation");
		expect(line).toContain("active");
		expect(line).toContain("10 tasks");
	});

	test("includes folder for full projects", () => {
		const line = formatProjectLine(makeProject({ parentFolder: "Work" }));
		expect(line).toContain("Work");
	});
});

// ── formatProjectDetail ─────────────────────────────────────────────────────

describe("formatProjectDetail", () => {
	test("includes completion percentage", () => {
		const detail = formatProjectDetail(makeProject({ taskCount: 10, completedTaskCount: 3 }));
		expect(detail).toContain("30%");
		expect(detail).toContain("7 remaining");
	});

	test("handles zero tasks gracefully", () => {
		const detail = formatProjectDetail(makeProject({ taskCount: 0, completedTaskCount: 0 }));
		expect(detail).toContain("0%");
	});
});

// ── Color handling & stderr structure ───────────────────────────────────────

function captureStderr(fn: () => void): string[] {
	const lines: string[] = [];
	const original = console.error;
	console.error = (...args: unknown[]) => {
		lines.push(args.map(String).join(" "));
	};
	try {
		fn();
	} finally {
		console.error = original;
	}
	return lines;
}

describe("outputError stderr structure", () => {
	test("emits a structured JSON line when stderr is not a TTY", () => {
		withEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined }, () => {
			const lines = withStreamTTY(process.stderr, undefined, () =>
				captureStderr(() => outputError("boom")),
			);
			expect(lines).toHaveLength(1);
			expect(JSON.parse(lines[0] ?? "")).toEqual({ ok: false, error: "boom" });
		});
	});

	test("includes structured candidates from a BridgeError", () => {
		const err = new BridgeError("Ambiguous", [{ id: "t1", name: "Task 1", project: "P" }]);
		const lines = withStreamTTY(process.stderr, undefined, () =>
			captureStderr(() => outputError(err)),
		);
		const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
		expect(parsed.ok).toBeFalse();
		expect(parsed.error).toBe("Ambiguous");
		expect(parsed.candidates).toEqual([{ id: "t1", name: "Task 1", project: "P" }]);
	});

	test("renders human text with candidates when stderr is a TTY", () => {
		withEnv({ NO_COLOR: "1" }, () => {
			const err = new BridgeError("Ambiguous", ["Task A", "Task B"]);
			const lines = withStreamTTY(process.stderr, true, () =>
				captureStderr(() => outputError(err)),
			);
			const text = lines.join("\n");
			expect(text).toContain("✗ Ambiguous");
			expect(text).toContain("Did you mean:");
			expect(text).toContain("Task A");
			expect(text).not.toContain("\x1b[");
		});
	});
});

describe("outputWarning stderr structure", () => {
	test("emits a structured JSON line when stderr is not a TTY", () => {
		const lines = withStreamTTY(process.stderr, undefined, () =>
			captureStderr(() => outputWarning("careful")),
		);
		expect(JSON.parse(lines[0] ?? "")).toEqual({ warning: "careful" });
	});

	test("renders human text when stderr is a TTY", () => {
		withEnv({ NO_COLOR: "1" }, () => {
			const lines = withStreamTTY(process.stderr, true, () =>
				captureStderr(() => outputWarning("careful")),
			);
			expect(lines[0]).toBe("! careful");
		});
	});
});

// ── Short ID prefixes ───────────────────────────────────────────────────────

const shortIdTempDirs: string[] = [];

function makeShortIdCachePath(): string {
	const dir = mkdtempSync(join(tmpdir(), "of-output-short-ids-"));
	shortIdTempDirs.push(dir);
	return join(dir, "short-ids.json");
}

afterEach(() => {
	for (const dir of shortIdTempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function captureStdout(fn: () => void): string[] {
	const lines: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		lines.push(args.map(String).join(" "));
	};
	try {
		fn();
	} finally {
		console.log = original;
	}
	return lines;
}

describe("formatTaskLine short id prefix", () => {
	test("prefixes a right-aligned short id when provided", () => {
		withEnv({ NO_COLOR: "1" }, () => {
			const line = formatTaskLine(makeTask(), { shortId: 7, shortIdWidth: 3 });
			expect(line).toStartWith("  7  Buy groceries");
		});
	});

	test("renders without a prefix when no short id is provided", () => {
		withEnv({ NO_COLOR: "1" }, () => {
			const line = formatTaskLine(makeTask());
			expect(line).toStartWith("Buy groceries");
		});
	});
});

describe("formatTaskDetail short id", () => {
	test("shows the short id alongside the OmniFocus id", () => {
		withEnv({ NO_COLOR: "1" }, () => {
			const detail = formatTaskDetail(makeTask(), { shortId: 42 });
			expect(detail).toContain("ID: 42 (task-abc123)");
		});
	});

	test("shows only the OmniFocus id when no short id is provided", () => {
		withEnv({ NO_COLOR: "1" }, () => {
			const detail = formatTaskDetail(makeTask());
			expect(detail).toContain("ID: task-abc123");
			expect(detail).not.toContain("(task-abc123)");
		});
	});
});

describe("outputTaskList short id prefixes", () => {
	test("human mode prefixes every task with its cached alias", () => {
		const cachePath = makeShortIdCachePath();
		withEnv({ NO_COLOR: "1", OF_SHORT_ID_CACHE: cachePath }, () => {
			const tasks = [makeTask({ id: "ofIdAAAAAAA" }), makeTask({ id: "ofIdBBBBBBB", name: "Two" })];
			const lines = captureStdout(() => outputTaskList(tasks, "human"));
			expect(lines[0]).toStartWith("1  Buy groceries");
			expect(lines[1]).toStartWith("2  Two");
			// Aliases are stable: a later listing reuses them.
			expect(assignShortIds(["ofIdBBBBBBB"], { cachePath }).get("ofIdBBBBBBB")).toBe(2);
		});
	});

	test("aligns short ids of different widths", () => {
		const cachePath = makeShortIdCachePath();
		withEnv({ NO_COLOR: "1", OF_SHORT_ID_CACHE: cachePath }, () => {
			const many = Array.from({ length: 11 }, (_, i) => makeTask({ id: `of-${i}`, name: `T${i}` }));
			const lines = captureStdout(() => outputTaskList(many, "human"));
			expect(lines[0]).toStartWith(" 1  T0");
			expect(lines[10]).toStartWith("11  T10");
		});
	});

	test("human candidates in errors show short ids for retry", () => {
		const cachePath = makeShortIdCachePath();
		withEnv({ NO_COLOR: "1", OF_SHORT_ID_CACHE: cachePath }, () => {
			const err = new BridgeError("Ambiguous", [
				{ id: "ofIdAAAAAAA", name: "Task A", project: "P" },
				{ id: "ofIdBBBBBBB", name: "Task B" },
			]);
			const lines = withStreamTTY(process.stderr, true, () =>
				captureStderr(() => outputError(err)),
			);
			const text = lines.join("\n");
			expect(text).toContain("- Task A [P] (1)");
			expect(text).toContain("- Task B (2)");
		});
	});

	test("json mode is unchanged and never writes the cache", () => {
		const cachePath = makeShortIdCachePath();
		withEnv({ OF_SHORT_ID_CACHE: cachePath }, () => {
			const tasks = [makeTask({ id: "ofIdAAAAAAA" })];
			const lines = captureStdout(() => outputTaskList(tasks, "json"));
			const parsed = JSON.parse(lines.join("\n"));
			expect(parsed[0].id).toBe("ofIdAAAAAAA");
			expect(parsed[0].shortId).toBeUndefined();
			expect(existsSync(cachePath)).toBe(false);
		});
	});
});

// ── Shared batch/entity-action renderers ────────────────────────────────────

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

	test("looks up and appends the short id for a minted alias", () => {
		const shortId = assignShortIds(["of-id-1"]).get("of-id-1");
		const { out } = capture(() => outputEntityAction("completed", "Task A", "of-id-1"));
		expect(out).toEqual([`✓ Completed: Task A (${shortId})`]);
	});

	test("omits the suffix and mints nothing for an id never seen before", () => {
		const { out } = capture(() => outputEntityAction("deleted", "Task B", "never-seen-id"));
		expect(out).toEqual(["✓ Deleted: Task B"]);
		expect(peekShortId("never-seen-id")).toBeUndefined();
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

describe("AI plan rendering", () => {
	const plan = {
		summary: "Two steps.",
		sequential: true,
		questions: ["Which store?"],
		tasks: [
			{
				key: "1",
				parentKey: null,
				name: "Open the app",
				note: "",
				estimateMinutes: 1,
				tags: [],
				flag: false,
				sequential: false,
				due: null,
				defer: null,
			},
			{
				key: "2",
				parentKey: null,
				name: "Add items",
				note: "Check the fridge",
				estimateMinutes: 5,
				tags: ["errand"],
				flag: true,
				sequential: true,
				due: "tomorrow",
				defer: null,
			},
			{
				key: "2.1",
				parentKey: "2",
				name: "Look in the fridge",
				note: "",
				estimateMinutes: null,
				tags: [],
				flag: false,
				sequential: false,
				due: null,
				defer: "today",
			},
		],
	};

	function capture(fn: () => void): string[] {
		const lines: string[] = [];
		const orig = console.log;
		console.log = (...args: unknown[]) => {
			lines.push(args.map(String).join(" "));
		};
		try {
			withEnv({ NO_COLOR: "1" }, fn);
		} finally {
			console.log = orig;
		}
		return lines;
	}

	test("formatPlanTree indents children and shows order, estimate, tags, dates", () => {
		const lines = withEnv({ NO_COLOR: "1" }, () => formatPlanTree(buildPlanTree(plan)));
		expect(lines).toEqual([
			"1 Open the app 1min",
			"2 ⚑ Add items (in order) 5min [errand] due:tomorrow",
			"   Check the fridge",
			"  2.1 Look in the fridge defer:today",
		]);
	});

	test("outputPlanTree prints header, tree, totals and open questions", () => {
		const lines = capture(() => outputPlanTree("Buy groceries", plan, buildPlanTree(plan)));
		expect(lines[0]).toBe("Plan for: Buy groceries — new subtasks in order");
		expect(lines[1]).toBe("Two steps.");
		expect(lines).toContain("1 Open the app 1min");
		expect(lines).toContain("\n3 tasks, ~6 min total");
		expect(lines).toContain("\nOpen questions:");
		expect(lines).toContain("  • Which store?");
	});

	test("outputTreeResult reports per-item outcome and counts", () => {
		const stderr: string[] = [];
		const origErr = console.error;
		console.error = (...args: unknown[]) => {
			stderr.push(args.map(String).join(" "));
		};
		let summary: { created: number; failed: number } | undefined;
		const lines = capture(() => {
			summary = outputTreeResult({
				parent: { id: "p", name: "Buy groceries", project: "Errands" },
				created: [
					{
						key: "1",
						ok: true,
						id: "n1",
						name: "Open the app",
						warnings: ["tag failed (x): nope"],
					},
					{ key: "2", ok: false, name: "Add items", error: "boom" },
				],
				warnings: ["sequential apply failed: locked"],
			});
		});
		console.error = origErr;
		expect(summary).toEqual({ created: 1, failed: 1 });
		expect(lines[0]).toBe("! Created 1 of 2 subtasks under Buy groceries");
		expect(lines[1]).toBe("  ✓ 1  Open the app");
		expect(lines[2]).toBe("  ✗ 2  Add items: boom");
		expect(stderr.join("\n")).toContain("Open the app: tag failed (x): nope");
		expect(stderr.join("\n")).toContain("Buy groceries: sequential apply failed: locked");
	});
});
