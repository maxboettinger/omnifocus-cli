/**
 * Tests for ops["review"]'s "Active project progress" section in
 * src/jxa/bridge.js, run against a stubbed OmniFocus document via the
 * bridge harness.
 *
 * The projectProgress loop used to materialize `pj.flattenedTasks()` and
 * loop `tasks[k].completed()` per task per active project — one Apple Event
 * per task per project, on top of the per-project loop over ~130 projects.
 * The fix batch-reads `.completed()` once via the `flattenedTasks`
 * *specifier* (`pj.flattenedTasks.completed()`, not `pj.flattenedTasks()`),
 * matching the pattern already used by `formatProject()`.
 *
 * The fixture below deliberately makes the two access paths disagree:
 * materializing `pj.flattenedTasks()` (the old per-task-ref path) yields
 * refs that all report `completed(): false` regardless of the real data,
 * while the batch getter `pj.flattenedTasks.completed()` (the fixed path)
 * returns the real per-task values. A regression back to
 * materializing-and-looping therefore fails these assertions (reporting
 * completedCount: 0 for every project) instead of accidentally passing.
 */

import { describe, expect, test } from "bun:test";
import { makeElementArray, makeJxaObject, runBridge } from "./bridge-harness.js";

function makeProgressProject(
	name: string,
	status: string,
	completedFlags: boolean[],
): Record<string, unknown> {
	const project = makeJxaObject({ id: name, name, status }) as Record<string, unknown>;
	const specifier = (() =>
		completedFlags.map(() => makeJxaObject({ completed: false }))) as unknown as CallableFunction &
		Record<string, () => unknown>;
	Object.defineProperty(specifier, "completed", { value: () => completedFlags });
	project.flattenedTasks = specifier;
	return project;
}

function completedTaskEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		completed: false,
		completionDate: null,
		name: "task",
		id: "id",
		note: "",
		estimatedMinutes: null,
		tags: [],
		containingProject: null,
		...overrides,
	};
}

describe("review projectProgress", () => {
	test("computes taskCount/completedCount from batch completed() array, not materialized-ref completed()", () => {
		const projects = [
			makeProgressProject("Alpha", "active status", [true, true, false]),
			makeProgressProject("OnHold", "on hold status", [true]),
		];
		const doc = {
			// makeElementArray needs at least one element to infer batch-getter
			// keys; this task is incomplete so it never enters completedTasks.
			flattenedTasks: makeElementArray([completedTaskEntry({ completed: false })]),
			flattenedProjects: () => projects,
		};

		const response = runBridge(doc, "review", { days: 7 });
		expect(response.ok).toBe(true);
		const data = response.data as {
			projectProgress: Array<{
				name: string;
				taskCount: number;
				completedCount: number;
				percentage: number;
			}>;
		};
		expect(data.projectProgress).toEqual([
			{ name: "Alpha", taskCount: 3, completedCount: 2, percentage: 67 },
		]);
	});

	test("excludes active projects with zero tasks", () => {
		const projects = [makeProgressProject("Empty", "active status", [])];
		const doc = {
			flattenedTasks: makeElementArray([completedTaskEntry({ completed: false })]),
			flattenedProjects: () => projects,
		};

		const response = runBridge(doc, "review", { days: 7 });
		expect(response.ok).toBe(true);
		const data = response.data as { projectProgress: unknown[] };
		expect(data.projectProgress).toEqual([]);
	});

	test("still reports completedTasks summary from doc-level batch data", () => {
		const now = new Date();
		const doc = {
			flattenedTasks: makeElementArray([
				completedTaskEntry({ name: "done-task", completed: true, completionDate: now }),
				completedTaskEntry({ name: "open-task", completed: false }),
			]),
			flattenedProjects: () => [],
		};

		const response = runBridge(doc, "review", { days: 7 });
		expect(response.ok).toBe(true);
		const data = response.data as { completedTasks: Array<{ name: string }> };
		expect(data.completedTasks.map((t) => t.name)).toEqual(["done-task"]);
	});
});
