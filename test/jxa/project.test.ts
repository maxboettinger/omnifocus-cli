/**
 * Regression tests for formatProject()/ops["project.get"]/ops["project.list"]
 * in src/jxa/bridge.js, run against a stubbed OmniFocus document via the
 * bridge harness.
 *
 * formatProject() used to loop `tasks[i].completed()` per task after
 * materializing `project.flattenedTasks()`, and ops["project.get"] did the
 * same again for overdueCount (`completed()` + `dueDate()` per task).
 * ops["project.list"]'s activeOnly branch had a third per-task loop. On the
 * live ~3k-task / ~130-project database, that's up to three full
 * materialize-and-loop passes per project and `project list --full --json`
 * timed out at 30s. The fix batch-reads `completed()`/`dueDate()` once per
 * project via the project's `flattenedTasks` specifier (no per-task Apple
 * Events), matching the pattern already used by doc-level
 * ops["task.list"]/ops["stats"]/ops["task.search"].
 *
 * The fixture's flattenedTasks specifier deliberately makes the two access
 * paths disagree: materializing it (`project.flattenedTasks()`, the old
 * per-task-loop path) yields refs that all report `completed: false` /
 * `dueDate: null` regardless of the real data, while the batch getters
 * (`project.flattenedTasks.completed()` / `.dueDate()`, the fixed path)
 * return the real per-task values. A regression back to materializing and
 * looping therefore fails these assertions instead of accidentally passing.
 */

import { describe, expect, test } from "bun:test";
import { makeJxaObject, runBridge } from "./bridge-harness.js";

function taskEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		completed: false,
		dueDate: null,
		...overrides,
	};
}

/**
 * Builds a project mock: scalar fields go through makeJxaObject (so
 * project.id(), project.name(), etc. work as zero-arg getters). flattenedTasks
 * is assigned directly afterward — bypassing makeJxaObject's uniform
 * zero-arg-getter wrapping — as a specifier that is both callable (materializes
 * to per-task refs) and exposes batch getters, matching real JXA's specifier
 * semantics for `project.flattenedTasks` (bare property access, no call
 * needed to batch-read a property across every task).
 */
function makeProject(
	scalars: Record<string, unknown>,
	tasks: Array<Record<string, unknown>>,
): Record<string, unknown> {
	const project = makeJxaObject({
		id: "proj-id",
		name: "Project",
		note: "",
		status: "active status",
		dueDate: null,
		deferDate: null,
		flagged: false,
		sequential: false,
		completed: false,
		completionDate: null,
		...scalars,
	}) as Record<string, unknown>;
	const completedValues = tasks.map((t) => Boolean(t.completed));
	const dueDateValues = tasks.map((t) => (t.dueDate as Date | null) ?? null);
	// Materializing intentionally returns "wrong" per-task refs — see file header.
	const specifier = (() =>
		tasks.map(() =>
			makeJxaObject({ completed: false, dueDate: null }),
		)) as unknown as CallableFunction & Record<string, () => unknown>;
	Object.defineProperty(specifier, "completed", { value: () => completedValues });
	Object.defineProperty(specifier, "dueDate", { value: () => dueDateValues });
	project.flattenedTasks = specifier;
	return project;
}

describe("project.list full", () => {
	test("computes taskCount/completedTaskCount from batch arrays", () => {
		const projects = [
			makeProject({ id: "p1", name: "Alpha" }, [
				taskEntry({ completed: true }),
				taskEntry({ completed: false }),
				taskEntry({ completed: true }),
			]),
			makeProject({ id: "p2", name: "Beta" }, [taskEntry({ completed: false })]),
		];
		const doc = { flattenedProjects: () => projects };

		const response = runBridge(doc, "project.list", { full: true });
		expect(response.ok).toBe(true);
		const data = response.data as Array<{
			name: string;
			taskCount: number;
			completedTaskCount: number;
		}>;
		expect(
			data.map((p) => ({
				name: p.name,
				taskCount: p.taskCount,
				completedTaskCount: p.completedTaskCount,
			})),
		).toEqual([
			{ name: "Alpha", taskCount: 3, completedTaskCount: 2 },
			{ name: "Beta", taskCount: 1, completedTaskCount: 0 },
		]);
	});

	test("project with no tasks reports zero counts", () => {
		const projects = [makeProject({ id: "p1", name: "Empty" }, [])];
		const doc = { flattenedProjects: () => projects };

		const response = runBridge(doc, "project.list", { full: true });
		expect(response.ok).toBe(true);
		const data = response.data as Array<{ taskCount: number; completedTaskCount: number }>;
		expect(data[0]?.taskCount).toBe(0);
		expect(data[0]?.completedTaskCount).toBe(0);
	});
});

describe("project.list activeOnly", () => {
	test("excludes projects where every task is completed", () => {
		const projects = [
			makeProject({ id: "p1", name: "AllDone" }, [
				taskEntry({ completed: true }),
				taskEntry({ completed: true }),
			]),
			makeProject({ id: "p2", name: "HasOpen" }, [
				taskEntry({ completed: true }),
				taskEntry({ completed: false }),
			]),
			makeProject({ id: "p3", name: "Empty" }, []),
		];
		const doc = { flattenedProjects: () => projects };

		const response = runBridge(doc, "project.list", { activeOnly: true });
		expect(response.ok).toBe(true);
		expect(response.data).toEqual(["HasOpen"]);
	});
});

describe("project.get", () => {
	const now = Date.now();
	const yesterday = new Date(now - 86400000);
	const tomorrow = new Date(now + 86400000);

	test("overdueCount counts only incomplete tasks past due; completed overdue tasks never count", () => {
		const project = makeProject({ id: "p1", name: "Mixed" }, [
			taskEntry({ completed: false, dueDate: yesterday }), // overdue → counts
			taskEntry({ completed: false, dueDate: tomorrow }), // future → doesn't count
			taskEntry({ completed: true, dueDate: yesterday }), // completed-overdue → doesn't count
			taskEntry({ completed: false, dueDate: null }), // no due date → doesn't count
		]);
		const doc = { flattenedProjects: () => [project] };

		const response = runBridge(doc, "project.get", { query: "Mixed" });
		expect(response.ok).toBe(true);
		const data = response.data as {
			overdueCount: number;
			taskCount: number;
			completedTaskCount: number;
			completionPercentage: number;
		};
		expect(data.overdueCount).toBe(1);
		expect(data.taskCount).toBe(4);
		expect(data.completedTaskCount).toBe(1);
		expect(data.completionPercentage).toBe(25);
	});

	test("project with zero tasks has zero completionPercentage and overdueCount", () => {
		const project = makeProject({ id: "p1", name: "Empty" }, []);
		const doc = { flattenedProjects: () => [project] };

		const response = runBridge(doc, "project.get", { query: "Empty" });
		expect(response.ok).toBe(true);
		const data = response.data as { overdueCount: number; completionPercentage: number };
		expect(data.overdueCount).toBe(0);
		expect(data.completionPercentage).toBe(0);
	});
});
