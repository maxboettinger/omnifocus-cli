/**
 * Regression tests for ops["task.list"] in src/jxa/bridge.js, run against
 * a stubbed OmniFocus document via the bridge harness.
 */

import { describe, expect, test } from "bun:test";
import { makeElementArray, runBridge } from "./bridge-harness.js";

function inboxEntry(name: string, completed: boolean): Record<string, unknown> {
	return {
		name,
		id: `id-${name}`,
		note: "",
		dueDate: null,
		deferDate: null,
		plannedDate: null,
		flagged: false,
		estimatedMinutes: null,
		completed,
		tags: [],
		repetitionRule: null,
		sequential: false,
		tasks: [],
		creationDate: null,
		modificationDate: null,
	};
}

function fullTask(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name,
		id: `id-${name}`,
		note: "",
		dueDate: null,
		deferDate: null,
		flagged: false,
		estimatedMinutes: null,
		completed: false,
		completionDate: null,
		blocked: false,
		...overrides,
	};
}

describe("task.list non-inbox filters", () => {
	const yesterday = new Date(Date.now() - 86400000);
	const tomorrow = new Date(Date.now() + 86400000);
	const nextWeek = new Date(Date.now() + 7 * 86400000);
	const doc = {
		flattenedTasks: makeElementArray([
			fullTask("done", { completed: true, flagged: true }),
			fullTask("overdue-task", { dueDate: yesterday }),
			fullTask("due-soon-task", { dueDate: tomorrow, flagged: true }),
			fullTask("later-task", { dueDate: nextWeek, blocked: true }),
			fullTask("free-task"),
		]),
	};

	function names(response: { data?: unknown }): string[] {
		return (response.data as Array<{ name: string }>).map((t) => t.name);
	}

	test("overdue filter returns only incomplete tasks due in the past", () => {
		const response = runBridge(doc, "task.list", { filter: "overdue" });
		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["overdue-task"]);
	});

	test("due-soon filter returns tasks due within three days", () => {
		const response = runBridge(doc, "task.list", { filter: "due-soon" });
		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["due-soon-task"]);
	});

	test("flagged filter skips completed tasks", () => {
		const response = runBridge(doc, "task.list", { filter: "flagged" });
		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["due-soon-task"]);
	});

	test("available filter excludes blocked tasks", () => {
		const response = runBridge(doc, "task.list", { filter: "available" });
		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["overdue-task", "due-soon-task", "free-task"]);
	});

	test("all filter respects limit", () => {
		const response = runBridge(doc, "task.list", { filter: "all", limit: 2 });
		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["overdue-task", "due-soon-task"]);
	});

	test("unknown filter fails even when no tasks match", () => {
		const response = runBridge({ flattenedTasks: makeElementArray([]) }, "task.list", {
			filter: "bogus",
		});
		expect(response.ok).toBe(false);
		expect(response.error).toContain("Unknown filter");
	});
});

describe("task.list status flags", () => {
	test("reports a task's own dropped state and the one it inherits", () => {
		const doc = {
			flattenedTasks: makeElementArray([
				fullTask("in-dropped-project", { effectivelyDropped: true }),
				fullTask("dropped-itself", { dropped: true }),
				fullTask("in-done-project", { effectivelyCompleted: true }),
			]),
		};
		const response = runBridge(doc, "task.list", { filter: "all" });
		expect(response.ok).toBe(true);
		expect(response.data).toMatchObject([
			{ name: "in-dropped-project", dropped: false, effectivelyDropped: true },
			{ name: "dropped-itself", dropped: true },
			{ name: "in-done-project", effectivelyCompleted: true },
		]);
	});

	test("defaults the status flags to false when OmniFocus withholds them", () => {
		const doc = { flattenedTasks: makeElementArray([fullTask("plain")]) };
		const response = runBridge(doc, "task.list", { filter: "all" });
		expect(response.ok).toBe(true);
		expect(response.data).toMatchObject([
			{ dropped: false, effectivelyCompleted: false, effectivelyDropped: false },
		]);
	});
});

describe("task.list inbox filter", () => {
	// OmniFocus keeps completed tasks in inboxTasks until cleanup, ordered
	// oldest-first — a real inbox routinely starts with hundreds of them.
	const entries = [
		...Array.from({ length: 8 }, (_, i) => inboxEntry(`done-${i}`, true)),
		...Array.from({ length: 4 }, (_, i) => inboxEntry(`open-${i}`, false)),
	];
	const doc = { inboxTasks: makeElementArray(entries) };

	test("marks a dropped inbox task instead of passing it off as active", () => {
		const dropped = { ...inboxEntry("dropped-item", false), dropped: true };
		const response = runBridge({ inboxTasks: makeElementArray([dropped]) }, "task.list", {
			filter: "inbox",
		});
		expect(response.ok).toBe(true);
		expect(response.data).toMatchObject([
			{ name: "dropped-item", dropped: true, effectivelyDropped: true },
		]);
	});

	test("limit caps returned results, not the scan window", () => {
		const response = runBridge(doc, "task.list", { filter: "inbox", limit: 5 });
		expect(response.ok).toBe(true);
		const names = (response.data as Array<{ name: string }>).map((t) => t.name);
		expect(names).toEqual(["open-0", "open-1", "open-2", "open-3"]);
	});

	test("limit truncates once enough incomplete tasks are found", () => {
		const response = runBridge(doc, "task.list", { filter: "inbox", limit: 2 });
		expect(response.ok).toBe(true);
		const names = (response.data as Array<{ name: string }>).map((t) => t.name);
		expect(names).toEqual(["open-0", "open-1"]);
	});

	test("newestFirst sorts by creation date before applying the limit", () => {
		const dated = [
			{ ...inboxEntry("old", false), creationDate: new Date("2026-01-01") },
			{ ...inboxEntry("done-new", true), creationDate: new Date("2026-07-01") },
			{ ...inboxEntry("newest", false), creationDate: new Date("2026-06-30") },
			{ ...inboxEntry("middle", false), creationDate: new Date("2026-03-15") },
		];
		const response = runBridge({ inboxTasks: makeElementArray(dated) }, "task.list", {
			filter: "inbox",
			limit: 2,
			newestFirst: true,
		});
		expect(response.ok).toBe(true);
		const names = (response.data as Array<{ name: string }>).map((t) => t.name);
		expect(names).toEqual(["newest", "middle"]);
	});

	test("default limit returns all incomplete tasks even past 500 raw entries", () => {
		const bigEntries = [
			...Array.from({ length: 600 }, (_, i) => inboxEntry(`done-${i}`, true)),
			inboxEntry("open-late", false),
		];
		const response = runBridge({ inboxTasks: makeElementArray(bigEntries) }, "task.list", {
			filter: "inbox",
		});
		expect(response.ok).toBe(true);
		const names = (response.data as Array<{ name: string }>).map((t) => t.name);
		expect(names).toEqual(["open-late"]);
	});
});
