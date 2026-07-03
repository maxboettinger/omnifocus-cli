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

describe("task.list inbox filter", () => {
	// OmniFocus keeps completed tasks in inboxTasks until cleanup, ordered
	// oldest-first — a real inbox routinely starts with hundreds of them.
	const entries = [
		...Array.from({ length: 8 }, (_, i) => inboxEntry(`done-${i}`, true)),
		...Array.from({ length: 4 }, (_, i) => inboxEntry(`open-${i}`, false)),
	];
	const doc = { inboxTasks: makeElementArray(entries) };

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
