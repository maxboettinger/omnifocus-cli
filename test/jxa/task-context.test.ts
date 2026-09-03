/**
 * ops["task.context"] — the one-call context bundle behind the AI verbs:
 * the task, its ancestor chain (minus the project's root task), its
 * project, its existing subtree (completed children included, capped),
 * its siblings (batch-read) and every tag name.
 */

import { describe, expect, test } from "bun:test";
import type { TaskContext } from "../../src/core/types.js";
import { makeElementArray, runBridge } from "./bridge-harness.js";

interface FakeTaskSpec {
	id: string;
	name: string;
	completed?: boolean;
	children?: FakeTaskSpec[];
	parent?: FakeTask | null;
	project?: FakeProject | null;
}

type FakeTask = Record<string, unknown> & { __children: FakeTask[] };
type FakeProject = Record<string, unknown>;

/** A task object satisfying every unguarded getter formatTask() reads. */
function fakeTask(spec: FakeTaskSpec): FakeTask {
	const children: FakeTask[] = [];
	// defineProperty: `name` is a readonly property on functions.
	const tasksSpec = Object.defineProperties(() => children, {
		id: { value: () => children.map((c) => (c.id as () => string)()) },
		name: { value: () => children.map((c) => (c.name as () => string)()) },
		completed: { value: () => children.map((c) => (c.completed as () => boolean)()) },
	});
	const task: FakeTask = {
		__children: children,
		id: () => spec.id,
		name: () => spec.name,
		note: () => "",
		dueDate: () => null,
		deferDate: () => null,
		flagged: () => false,
		estimatedMinutes: () => null,
		completed: () => spec.completed ?? false,
		completionDate: () => null,
		tags: () => [],
		repetitionRule: () => null,
		parentTask: () => spec.parent ?? null,
		containingProject: () => spec.project ?? null,
		tasks: tasksSpec,
	};
	for (const child of spec.children ?? []) {
		children.push(fakeTask({ ...child, parent: task, project: spec.project ?? null }));
	}
	return task;
}

function fakeProject(id: string, name: string, rootTask: FakeTask): FakeProject {
	return {
		id: () => id,
		name: () => name,
		note: () => "",
		dueDate: () => null,
		deferDate: () => null,
		flagged: () => false,
		completed: () => false,
		completionDate: () => null,
		status: () => "active status",
		flattenedTasks: { completed: () => [false, true] },
		rootTask: () => rootTask,
		get tasks() {
			return rootTask.tasks;
		},
	};
}

function docWith(tasks: FakeTask[], tags: string[] = ["errand", "home"]) {
	const all = new Map<string, FakeTask>();
	const visit = (t: FakeTask) => {
		all.set((t.id as () => string)(), t);
		for (const c of t.__children) visit(c);
	};
	for (const t of tasks) visit(t);
	return {
		flattenedTasks: {
			byId: (id: string) => {
				const found = all.get(id);
				if (!found) throw new Error("not found");
				return found;
			},
		},
		flattenedProjects: () => [],
		flattenedTags: makeElementArray(tags.map((name) => ({ name }))),
		inboxTasks: makeElementArray([]),
	};
}

describe("task.context", () => {
	test("bundles ancestors, project, subtree, siblings and tags for a nested task", () => {
		// Project "Taxes" → root task → "Gather documents" (parent) → "Find W2" (target, has children)
		const root = fakeTask({ id: "root", name: "Taxes" });
		const project = fakeProject("proj-1", "Taxes", root);
		const parent = fakeTask({
			id: "t-parent",
			name: "Gather documents",
			parent: root,
			project,
			children: [
				{
					id: "t-target",
					name: "Find W2",
					children: [
						{ id: "t-c1", name: "Open mail app", completed: true },
						{ id: "t-c2", name: "Search for W2" },
					],
				},
				{ id: "t-sib", name: "Find 1099", completed: true },
			],
		});
		root.__children.push(parent);
		const doc = docWith([root, parent]);

		const response = runBridge(doc, "task.context", { id: "t-target" });
		expect(response.ok).toBe(true);
		const data = response.data as TaskContext;
		expect(data.task.name).toBe("Find W2");
		expect(data.task.childCount).toBe(2);
		// Ancestors stop at the project's root task.
		expect(data.ancestors.map((a) => a.name)).toEqual(["Gather documents"]);
		expect(data.project?.name).toBe("Taxes");
		expect(data.project?.taskCount).toBe(2);
		expect(data.children.map((c) => [c.name, c.completed])).toEqual([
			["Open mail app", true],
			["Search for W2", false],
		]);
		expect(data.children[0]?.children).toEqual([]);
		expect(data.siblings).toEqual([{ id: "t-sib", name: "Find 1099", completed: true }]);
		expect(data.tags).toEqual(["errand", "home"]);
	});

	test("a top-level project task has no ancestors and its siblings are the project's tasks", () => {
		const root = fakeTask({ id: "root", name: "Taxes" });
		const project = fakeProject("proj-1", "Taxes", root);
		const a = fakeTask({ id: "a", name: "File return", parent: root, project });
		const b = fakeTask({ id: "b", name: "Pay bill", parent: root, project, completed: true });
		root.__children.push(a, b);
		const response = runBridge(docWith([root, a, b]), "task.context", { query: "a" });
		expect(response.ok).toBe(true);
		const data = response.data as TaskContext;
		expect(data.ancestors).toEqual([]);
		expect(data.siblings).toEqual([{ id: "b", name: "Pay bill", completed: true }]);
	});

	test("an inbox task reports no project and inbox siblings", () => {
		const t = fakeTask({ id: "i1", name: "Loose thought" });
		const doc = docWith([t]);
		doc.inboxTasks = makeElementArray([
			{ id: "i1", name: "Loose thought", completed: false },
			{ id: "i2", name: "Another", completed: false },
		]);
		const response = runBridge(doc, "task.context", { id: "i1" });
		expect(response.ok).toBe(true);
		const data = response.data as TaskContext;
		expect(data.project).toBeNull();
		expect(data.ancestors).toEqual([]);
		expect(data.siblings).toEqual([{ id: "i2", name: "Another", completed: false }]);
	});

	test("the subtree is capped at 200 nodes", () => {
		const many = Array.from({ length: 250 }, (_, i) => ({ id: `c${i}`, name: `Child ${i}` }));
		const t = fakeTask({ id: "big", name: "Big", children: many });
		const response = runBridge(docWith([t]), "task.context", { id: "big" });
		expect(response.ok).toBe(true);
		expect((response.data as TaskContext).children).toHaveLength(200);
	});

	test("unknown task fails like task.get", () => {
		const response = runBridge(docWith([]), "task.context", { id: "nope" });
		expect(response.ok).toBe(false);
		expect(response.error).toBe("Task not found with ID: nope");
		expect(runBridge(docWith([]), "task.context", {}).error).toBe("Task query or id required");
	});
});
