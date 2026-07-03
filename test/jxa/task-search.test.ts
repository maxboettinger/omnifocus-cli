/**
 * Regression tests for ops["task.search"] in src/jxa/bridge.js, run against
 * a stubbed OmniFocus document via the bridge harness.
 *
 * task.search used to match via doc.flattenedTasks.whose({ name: { _contains
 * } }) / the note variant. On a real ~3k-task database, whose()'s _contains
 * predicate is itself slow to evaluate — its cost scales with how many tasks
 * match, not with --limit, so a broad query (e.g. "e", matching ~90% of
 * tasks) times out before a single result is produced, independent of how
 * cheaply completed()/id() are read afterward. The fix batch-reads
 * name/note/completed/id once across the full (unfiltered) collection and
 * matches in JS instead, matching the pattern already used by
 * ops["task.list"]/ops["stats"]. These tests fix the fixture with no
 * doc.flattenedTasks.whose() at all, so a regression back to the whose()
 * form fails loudly instead of silently reintroducing the timeout.
 */

import { describe, expect, test } from "bun:test";
import { makeElementArray, makeJxaObject, runBridge } from "./bridge-harness.js";

function task(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name,
		id: `id-${name}`,
		note: "",
		completed: false,
		dueDate: null,
		deferDate: null,
		flagged: false,
		estimatedMinutes: null,
		completionDate: null,
		...overrides,
	};
}

function names(response: { data?: unknown }): string[] {
	return (response.data as Array<{ name: string }>).map((t) => t.name);
}

describe("task.search", () => {
	test("returns only incomplete matches, name matches before note matches, deduped by id", () => {
		const doc = {
			flattenedTasks: makeElementArray([
				task("Buy widget"), // name match only
				task("Other", { note: "remember to buy widget" }), // note match only
				task("widget-both", { note: "widget note too" }), // matches both -> once
				task("Widget done", { completed: true }), // name match but completed -> excluded
			]),
		};

		const response = runBridge(doc, "task.search", { query: "widget" });

		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["Buy widget", "widget-both", "Other"]);
	});

	test("limit caps results", () => {
		const doc = {
			flattenedTasks: makeElementArray([task("apple-1"), task("apple-2"), task("apple-3")]),
		};

		const response = runBridge(doc, "task.search", { query: "apple", limit: 2 });

		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["apple-1", "apple-2"]);
	});

	test("completed matches are skipped even when they fill the front of the match set", () => {
		const doc = {
			flattenedTasks: makeElementArray([
				task("task-a", { completed: true }),
				task("task-b", { completed: true }),
				task("task-c", { completed: true }),
				task("task-d"),
			]),
		};

		const response = runBridge(doc, "task.search", { query: "task", limit: 1 });

		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["task-d"]);
	});

	test("note-match set is not consulted once name matches fill the limit", () => {
		const doc = {
			flattenedTasks: makeElementArray([
				task("find-a"),
				task("find-b"),
				task("other", { note: "contains find too" }),
			]),
		};

		const response = runBridge(doc, "task.search", { query: "find", limit: 1 });

		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["find-a"]);
	});

	test("matches case-insensitively", () => {
		const doc = { flattenedTasks: makeElementArray([task("Widget")]) };

		const response = runBridge(doc, "task.search", { query: "WIDGET" });

		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["Widget"]);
	});

	test("reads name/note/completed/id as one batch call per property, not per scanned task", () => {
		const calls = { name: 0, note: 0, completed: 0, id: 0 };
		const entries = [
			task("task-a", { completed: true }),
			task("task-b", { completed: true }),
			task("task-c"),
		];
		function batchGetter(key: keyof typeof calls): () => unknown[] {
			return () => {
				calls[key]++;
				return entries.map((e) => e[key] ?? null);
			};
		}
		const flattenedTasks = (() => entries.map(makeJxaObject)) as unknown as CallableFunction &
			Record<string, () => unknown>;
		Object.defineProperty(flattenedTasks, "name", { value: batchGetter("name") });
		Object.defineProperty(flattenedTasks, "note", { value: batchGetter("note") });
		Object.defineProperty(flattenedTasks, "completed", { value: batchGetter("completed") });
		Object.defineProperty(flattenedTasks, "id", { value: batchGetter("id") });
		const doc = { flattenedTasks };

		const response = runBridge(doc, "task.search", { query: "task" });

		expect(response.ok).toBe(true);
		expect(names(response)).toEqual(["task-c"]);
		expect(calls.name).toBe(1);
		expect(calls.completed).toBe(1);
		expect(calls.id).toBe(1);
		expect(calls.note).toBe(1);
	});
});
