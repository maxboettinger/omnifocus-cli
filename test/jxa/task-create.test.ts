/**
 * ops["task.create"] — one op for inbox tasks, project tasks and subtasks.
 * `parent`/`parentId` nest the new task under an existing task; without a
 * project or parent the task lands in the inbox. bulk.create shares the
 * same record builder, so a parent is honoured there too.
 */

import { describe, expect, test } from "bun:test";
import { runBridge } from "./bridge-harness.js";

function parentTask(id: string, name: string, pushed: unknown[]) {
	return {
		id: () => id,
		name: () => name,
		tasks: { push: (t: unknown) => pushed.push(t) },
		containingProject: () => ({ name: () => "Errands" }),
	};
}

function docWithParent(pushed: unknown[], inbox: unknown[]) {
	const parent = parentTask("p1", "Parent", pushed);
	return {
		flattenedTasks: {
			byId: (id: string) => {
				if (id !== "p1") throw new Error("not found");
				return parent;
			},
		},
		flattenedProjects: () => [],
		inboxTasks: { push: (t: unknown) => inbox.push(t) },
	};
}

describe("task.create", () => {
	test("without project or parent creates an inbox task", () => {
		const inbox: unknown[] = [];
		const response = runBridge(docWithParent([], inbox), "task.create", { name: "Loose" });
		expect(response.ok).toBe(true);
		expect(inbox.length).toBe(1);
		expect((response.data as { parent?: unknown }).parent).toBeUndefined();
	});

	test("with parentId nests under the parent and reports it", () => {
		const pushed: unknown[] = [];
		const response = runBridge(docWithParent(pushed, []), "task.create", {
			name: "Child",
			parentId: "p1",
		});
		expect(response.ok).toBe(true);
		const data = response.data as {
			name: string;
			parent: { id: string; name: string; project: string };
		};
		expect(data.name).toBe("Child");
		expect(data.parent).toEqual({ id: "p1", name: "Parent", project: "Errands" });
		expect(pushed.length).toBe(1);
	});

	test("unknown parentId fails", () => {
		const response = runBridge(docWithParent([], []), "task.create", {
			name: "x",
			parentId: "nope",
		});
		expect(response.ok).toBe(false);
		expect(response.error).toBe("Parent task not found by ID: nope");
	});

	test("project and parent together are rejected", () => {
		const response = runBridge(docWithParent([], []), "task.create", {
			name: "x",
			project: "P",
			parentId: "p1",
		});
		expect(response.ok).toBe(false);
		expect(response.error).toBe("Use either project or parent, not both");
	});

	test("missing name fails", () => {
		const response = runBridge(docWithParent([], []), "task.create", {});
		expect(response.ok).toBe(false);
		expect(response.error).toBe("Task name required");
	});

	test("with parent name query nests under the parent and reports it", () => {
		const pushed: unknown[] = [];
		const parent = { ...parentTask("p1", "Parent", pushed), completed: () => false };
		const doc = {
			flattenedTasks: {
				byId: (id: string) => {
					throw new Error(`not found: ${id}`);
				},
				whose: (predicate: { name: string | { _contains: string } }) => {
					const name = "parent";
					const matches =
						typeof predicate.name === "string"
							? name === predicate.name.toLowerCase()
							: name.includes(predicate.name._contains.toLowerCase());
					return () => (matches ? [parent] : []);
				},
			},
			flattenedProjects: () => [],
			inboxTasks: { push: () => {} },
		};

		const response = runBridge(doc, "task.create", { name: "Child", parent: "Parent" });

		expect(response.ok).toBe(true);
		const data = response.data as {
			name: string;
			parent: { id: string; name: string; project: string };
		};
		expect(data.name).toBe("Child");
		expect(data.parent).toEqual({ id: "p1", name: "Parent", project: "Errands" });
		expect(pushed.length).toBe(1);
	});
});

describe("bulk.create", () => {
	test("honours parentId per item through the shared record builder", () => {
		const pushed: unknown[] = [];
		const response = runBridge(docWithParent(pushed, []), "bulk.create", {
			tasks: [{ name: "A", parentId: "p1" }, { name: "" }],
		});
		expect(response.ok).toBe(true);
		const results = response.data as Array<{
			ok: boolean;
			error?: string;
			name?: string;
			parent?: { id: string };
		}>;
		expect(results[0]?.ok).toBe(true);
		expect(results[0]?.parent?.id).toBe("p1");
		expect(results[1]).toEqual({ ok: false, error: "Task name required", name: "" });
	});
});
