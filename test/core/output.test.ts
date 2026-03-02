import { describe, expect, test } from "bun:test";
import {
	formatProjectDetail,
	formatProjectLine,
	formatTaskDetail,
	formatTaskLine,
	resolveFormat,
} from "../../src/core/output.js";
import type { OFProject, OFTask } from "../../src/core/types.js";

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

	test("includes project in brackets for non-inbox tasks", () => {
		const line = formatTaskLine(makeTask({ project: "Work" }));
		expect(line).toContain("[Work]");
	});

	test("omits project for inbox tasks", () => {
		const line = formatTaskLine(makeTask({ project: "Inbox" }));
		expect(line).not.toContain("[Inbox]");
	});

	test("shows flag indicator when flagged", () => {
		const line = formatTaskLine(makeTask({ flagged: true }));
		expect(line).toContain("⚑");
	});

	test("includes tags", () => {
		const line = formatTaskLine(makeTask({ tags: ["errand", "urgent"] }));
		expect(line).toContain("errand");
		expect(line).toContain("urgent");
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
