/**
 * ops["task.createTree"] — create a whole subtask tree in one round-trip.
 * Items nest under earlier items by `parentKey`; a failed item's
 * descendants are skipped, and per-item property problems are warnings.
 */

import { describe, expect, test } from "bun:test";
import type { CreateTreeResult } from "../../src/core/types.js";
import { makeElementArray, runBridge } from "./bridge-harness.js";

interface Created {
	tasks: () => Created[];
	name: () => string;
	note: () => string | null;
	estimatedMinutes: () => number | null;
	flagged: () => boolean;
	sequential: () => boolean | null;
}

function target(pushed: Created[]) {
	const state: Record<string, unknown> = {};
	return {
		id: () => "p1",
		name: () => "Parent",
		tasks: { push: (t: Created) => pushed.push(t) },
		containingProject: () => ({ name: () => "Errands" }),
		set sequential(v: unknown) {
			state.sequential = v;
		},
		get sequential() {
			return state.sequential;
		},
	};
}

function docWith(parent: ReturnType<typeof target>, tags: string[] = []) {
	return {
		flattenedTasks: {
			byId: (id: string) => {
				if (id !== "p1") throw new Error("not found");
				return parent;
			},
		},
		flattenedProjects: () => [
			{
				id: () => "proj-1",
				name: () => "Taxes",
				tasks: { push: (t: Created) => parent.tasks.push(t) },
			},
		],
		flattenedTags: makeElementArray(tags.map((name) => ({ name }))),
	};
}

describe("task.createTree", () => {
	test("creates nested items in order under the parent and reports each", () => {
		const pushed: Created[] = [];
		const parent = target(pushed);
		const response = runBridge(docWith(parent), "task.createTree", {
			parentId: "p1",
			sequential: true,
			tasks: [
				{ key: "1", parentKey: null, name: "Open portal", estimate: 2, sequential: true },
				{ key: "1.1", parentKey: "1", name: "Type URL", note: "portal.example" },
				{ key: "1.1.1", parentKey: "1.1", name: "Press enter" },
				{ key: "2", parentKey: null, name: "Log in", flag: true, sequential: false },
			],
		});
		expect(response.ok).toBe(true);
		const data = response.data as CreateTreeResult;
		expect(data.parent).toEqual({ id: "p1", name: "Parent", project: "Errands" });
		expect(data.warnings).toEqual([]);
		expect(data.created.map((c) => [c.key, c.ok, c.name])).toEqual([
			["1", true, "Open portal"],
			["1.1", true, "Type URL"],
			["1.1.1", true, "Press enter"],
			["2", true, "Log in"],
		]);
		expect(data.created.every((c) => c.ok && c.id && c.warnings?.length === 0)).toBe(true);
		// Only the two top-level items were pushed into the parent…
		expect(pushed.map((t) => t.name())).toEqual(["Open portal", "Log in"]);
		// …and the rest nested under their parentKey.
		const first = pushed[0] as Created;
		expect(first.tasks().map((t) => t.name())).toEqual(["Type URL"]);
		expect(
			first
				.tasks()[0]
				?.tasks()
				.map((t) => t.name()),
		).toEqual(["Press enter"]);
		expect(first.tasks()[0]?.note()).toBe("portal.example");
		expect(first.estimatedMinutes()).toBe(2);
		expect(first.sequential()).toBe(true);
		expect(pushed[1]?.flagged()).toBe(true);
		expect(pushed[1]?.sequential()).toBe(false);
		expect(parent.sequential).toBe(true);
	});

	test("the target's sequential flag is set even when it already has children", () => {
		// The type is a whole-container property: pre-existing children are governed by
		// it too, which is why the CLI preview points such a change out before applying.
		const pushed: Created[] = [];
		const parent = target(pushed);
		parent.sequential = false;
		const response = runBridge(docWith(parent), "task.createTree", {
			parentId: "p1",
			sequential: true,
			tasks: [{ key: "1", parentKey: null, name: "New step" }],
		});
		expect(response.ok).toBe(true);
		expect(parent.sequential).toBe(true);
		// Omitting the flag leaves the target untouched.
		runBridge(docWith(parent), "task.createTree", {
			parentId: "p1",
			tasks: [{ key: "1", parentKey: null, name: "Another" }],
		});
		expect(parent.sequential).toBe(true);
	});

	test("skips the descendants of a failed item instead of reparenting them", () => {
		const pushed: Created[] = [];
		const response = runBridge(docWith(target(pushed)), "task.createTree", {
			parentId: "p1",
			tasks: [
				{ key: "1", parentKey: null, name: "" },
				{ key: "1.1", parentKey: "1", name: "Orphan" },
				{ key: "1.1.1", parentKey: "1.1", name: "Grand-orphan" },
				{ key: "2", parentKey: "missing", name: "Bad parent" },
				{ key: "3", parentKey: null, name: "Fine" },
			],
		});
		expect(response.ok).toBe(true);
		const data = response.data as CreateTreeResult;
		expect(data.created.map((c) => [c.key, c.ok, c.error ?? null])).toEqual([
			["1", false, "Task name required"],
			["1.1", false, 'Skipped: parent "1" was not created'],
			["1.1.1", false, 'Skipped: parent "1.1" was not created'],
			["2", false, "Unknown parentKey: missing"],
			["3", true, null],
		]);
		expect(pushed.map((t) => t.name())).toEqual(["Fine"]);
	});

	test("a property that cannot be applied is a warning, not a lost task", () => {
		const pushed: Created[] = [];
		const response = runBridge(docWith(target(pushed), ["errand"]), "task.createTree", {
			parentId: "p1",
			tasks: [{ key: "1", parentKey: null, name: "Tagged", tags: ["nonexistent"] }],
		});
		expect(response.ok).toBe(true);
		const item = (response.data as CreateTreeResult).created[0];
		expect(item?.ok).toBe(true);
		expect(item?.warnings?.[0]).toContain("tag failed (nonexistent)");
		expect(pushed).toHaveLength(1);
	});

	test("accepts a projectId target instead of a parent task", () => {
		const pushed: Created[] = [];
		const response = runBridge(docWith(target(pushed)), "task.createTree", {
			projectId: "proj-1",
			tasks: [{ key: "1", parentKey: null, name: "Top level" }],
		});
		expect(response.ok).toBe(true);
		expect((response.data as CreateTreeResult).parent).toEqual({
			id: "proj-1",
			name: "Taxes",
			project: "Taxes",
		});
		expect(pushed.map((t) => t.name())).toEqual(["Top level"]);
	});

	test("validates its parameters", () => {
		const doc = docWith(target([]));
		expect(runBridge(doc, "task.createTree", { parentId: "p1" }).error).toBe("tasks required");
		expect(runBridge(doc, "task.createTree", { tasks: [{ name: "x" }] }).error).toBe(
			"parentId or projectId required",
		);
		expect(
			runBridge(doc, "task.createTree", {
				parentId: "p1",
				projectId: "proj-1",
				tasks: [{ name: "x" }],
			}).error,
		).toBe("Use either parentId or projectId, not both");
		expect(
			runBridge(doc, "task.createTree", { parentId: "zz", tasks: [{ name: "x" }] }).error,
		).toBe("Parent task not found by ID: zz");
		expect(
			runBridge(doc, "task.createTree", { projectId: "zz", tasks: [{ name: "x" }] }).error,
		).toBe("Project not found with ID: zz");
	});
});
