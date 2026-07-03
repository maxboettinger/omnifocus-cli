/**
 * Tests for ops["tag.list"] and ops["tag.tasks"] in src/jxa/bridge.js via the
 * bridge harness.
 *
 * `tag.list --count`/`--active-only` and `tag.tasks` used to materialize each
 * tag's `tasks()` element array once and then loop `tasks[i].completed()` per
 * task-ref — one Apple Event per task per tag. On the live ~3k-task database
 * this made `tag list --count` take 22.3s and `tag tasks <name>` take 12.3s
 * for 32 results. The fix batch-reads `.completed()` once via the `tasks`
 * *specifier* (`tag.tasks.completed()`, not `tag.tasks()`), matching the
 * pattern already used by `formatProject()`/`ops["task.list"]`/`ops["stats"]`.
 *
 * The fixtures below deliberately make the two access paths disagree:
 * materializing `tag.tasks()` (the old per-task-ref path) yields refs that
 * all report `completed(): false` regardless of the real data, while the
 * batch getter `tag.tasks.completed()` (the fixed path) returns the real
 * per-task values. A regression back to materializing-and-looping therefore
 * fails these assertions instead of accidentally passing.
 */

import { describe, expect, test } from "bun:test";
import { makeJxaObject, runBridge } from "./bridge-harness.js";

function taskEntry(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name,
		id: `id-${name}`,
		note: "",
		dueDate: null,
		deferDate: null,
		flagged: false,
		estimatedMinutes: null,
		completionDate: null,
		...overrides,
	};
}

/**
 * Builds a tag mock: `name`/`id` go through makeJxaObject (zero-arg getters).
 * `tasks` is assigned directly afterward — bypassing makeJxaObject's uniform
 * wrapping — as a specifier that is both callable (materializes to per-task
 * refs whose `.completed()` always lies and reports `false`) and exposes a
 * batch `.completed()` getter (the real values), matching real JXA specifier
 * semantics for `tag.tasks` (bare property access, no call needed to
 * batch-read a property across every task).
 */
function makeTag(
	name: string,
	id: string,
	tasks: Array<Record<string, unknown>>,
	completedFlags: boolean[],
): Record<string, unknown> {
	const tag = makeJxaObject({ name, id }) as Record<string, unknown>;
	const specifier = (() =>
		tasks.map((t) => makeJxaObject({ ...t, completed: false }))) as unknown as CallableFunction &
		Record<string, () => unknown>;
	Object.defineProperty(specifier, "completed", { value: () => completedFlags });
	tag.tasks = specifier;
	return tag;
}

describe("tag.list count", () => {
	test("computes taskCount/activeTaskCount from the batch completed() array", () => {
		const tags = [
			makeTag(
				"Alpha",
				"t1",
				[taskEntry("a1"), taskEntry("a2"), taskEntry("a3")],
				[true, false, false],
			),
			makeTag("Beta", "t2", [taskEntry("b1")], [true]),
			makeTag("Empty", "t3", [], []),
		];
		const doc = { flattenedTags: () => tags };

		const response = runBridge(doc, "tag.list", { count: true });
		expect(response.ok).toBe(true);
		const data = response.data as Array<{
			name: string;
			id: string;
			taskCount: number;
			activeTaskCount: number;
		}>;
		expect(data).toEqual([
			{ name: "Alpha", id: "t1", taskCount: 3, activeTaskCount: 2 },
			{ name: "Beta", id: "t2", taskCount: 1, activeTaskCount: 0 },
			{ name: "Empty", id: "t3", taskCount: 0, activeTaskCount: 0 },
		]);
	});
});

describe("tag.list activeOnly", () => {
	test("excludes tags whose tasks are all completed", () => {
		const tags = [
			makeTag("AllDone", "t1", [taskEntry("a1"), taskEntry("a2")], [true, true]),
			makeTag("HasOpen", "t2", [taskEntry("b1"), taskEntry("b2")], [true, false]),
			makeTag("Empty", "t3", [], []),
		];
		const doc = { flattenedTags: () => tags };

		const response = runBridge(doc, "tag.list", { activeOnly: true });
		expect(response.ok).toBe(true);
		expect(response.data).toEqual(["HasOpen"]);
	});
});

describe("tag.tasks", () => {
	test("returns only incomplete tasks (batch completed(), not materialized-ref completed())", () => {
		const tag = makeTag(
			"Routines",
			"tag-1",
			[taskEntry("done-1"), taskEntry("open-1"), taskEntry("done-2"), taskEntry("open-2")],
			[true, false, true, false],
		);
		const doc = { flattenedTags: () => [tag] };

		const response = runBridge(doc, "tag.tasks", { tagName: "Routines" });
		expect(response.ok).toBe(true);
		const names = (response.data as Array<{ name: string }>).map((t) => t.name);
		expect(names).toEqual(["open-1", "open-2"]);
	});

	test("respects limit when completed tasks fill the front", () => {
		const tag = makeTag(
			"Routines",
			"tag-1",
			[
				taskEntry("done-1"),
				taskEntry("done-2"),
				taskEntry("open-1"),
				taskEntry("open-2"),
				taskEntry("open-3"),
			],
			[true, true, false, false, false],
		);
		const doc = { flattenedTags: () => [tag] };

		const response = runBridge(doc, "tag.tasks", { tagName: "Routines", limit: 2 });
		expect(response.ok).toBe(true);
		const names = (response.data as Array<{ name: string }>).map((t) => t.name);
		expect(names).toEqual(["open-1", "open-2"]);
	});

	test("tag not found returns an error", () => {
		const doc = { flattenedTags: () => [] };
		const response = runBridge(doc, "tag.tasks", { tagName: "Nope" });
		expect(response.ok).toBe(false);
	});
});
