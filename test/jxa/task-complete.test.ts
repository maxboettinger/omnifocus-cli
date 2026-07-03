/**
 * Tests for ops["task.complete"] in src/jxa/bridge.js, run against a stubbed
 * OmniFocus document via the bridge harness.
 *
 * Name resolution (findTaskByQuery) filters by completion state, so a plain
 * "Task not found" used to be the answer both when no task matches and when
 * the task exists but is already completed — and since task.search/task.list
 * also hide completed tasks, callers had no way to tell the two apart. These
 * tests pin the fallback that reports the opposite-state match distinctly
 * ("Task already completed" / "Task is already incomplete").
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
		markComplete: null,
		markIncomplete: null,
		...overrides,
	};
}

/**
 * An element array that also supports the whose() predicates findTaskByQuery
 * issues: { name: "exact" } and { name: { _contains: "sub" } }. Apple Events
 * string comparison is case-insensitive by default; mirror that here.
 */
function makeQueryableTasks(elements: Array<Record<string, unknown>>): CallableFunction {
	const specifier = makeElementArray(elements);
	Object.defineProperty(specifier, "whose", {
		value: (predicate: { name: string | { _contains: string } }) => {
			const matched = elements.filter((e) => {
				const name = String(e.name).toLowerCase();
				if (typeof predicate.name === "string") return name === predicate.name.toLowerCase();
				return name.includes(predicate.name._contains.toLowerCase());
			});
			return () => matched.map(makeJxaObject);
		},
	});
	return specifier;
}

describe("task.complete", () => {
	test("completes an incomplete task matched by exact name", () => {
		const doc = { flattenedTasks: makeQueryableTasks([task("Ticket besorgen")]) };

		const response = runBridge(doc, "task.complete", { query: "Ticket besorgen" });

		expect(response.ok).toBe(true);
		const data = response.data as { action: string; name: string };
		expect(data.action).toBe("completed");
		expect(data.name).toBe("Ticket besorgen");
	});

	test("reports 'already completed' (not 'not found') when only a completed task matches", () => {
		const doc = {
			flattenedTasks: makeQueryableTasks([
				task("Ticket besorgen", {
					completed: true,
					completionDate: new Date("2026-07-01T10:00:00Z"),
				}),
			]),
		};

		const response = runBridge(doc, "task.complete", { query: "Ticket besorgen" });

		expect(response.ok).toBe(false);
		expect(response.error).toContain("already completed");
		expect(response.error).toContain("Ticket besorgen");
		expect(response.error).toContain("2026-07-01");
		expect(response.error).toContain("id-Ticket besorgen");
	});

	test("reports 'already incomplete' when --incomplete targets a task that is not completed", () => {
		const doc = { flattenedTasks: makeQueryableTasks([task("Ticket besorgen")]) };

		const response = runBridge(doc, "task.complete", {
			query: "Ticket besorgen",
			incomplete: true,
		});

		expect(response.ok).toBe(false);
		expect(response.error).toContain("already incomplete");
		expect(response.error).toContain("Ticket besorgen");
	});

	test("multiple completed matches surface as candidates, not 'not found'", () => {
		const doc = {
			flattenedTasks: makeQueryableTasks([
				task("report a", { completed: true }),
				task("report b", { completed: true }),
			]),
		};

		const response = runBridge(doc, "task.complete", { query: "report" });

		expect(response.ok).toBe(false);
		expect(response.error).toContain("completed");
		expect(response.candidates).toHaveLength(2);
	});

	test("ambiguity among incomplete tasks still errors with candidates", () => {
		const doc = {
			flattenedTasks: makeQueryableTasks([task("call mom"), task("call dad")]),
		};

		const response = runBridge(doc, "task.complete", { query: "call" });

		expect(response.ok).toBe(false);
		expect(response.error).toContain("Ambiguous");
		expect(response.candidates).toHaveLength(2);
	});

	test("no match in either completion state stays a plain 'Task not found'", () => {
		const doc = { flattenedTasks: makeQueryableTasks([task("something else")]) };

		const response = runBridge(doc, "task.complete", { query: "missing task" });

		expect(response.ok).toBe(false);
		expect(response.error).toBe('Task not found: "missing task"');
	});
});
