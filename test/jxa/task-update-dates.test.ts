/**
 * Date resolution in ops["task.update"] (via applyTaskProps/resolveDate).
 *
 * Exact ISO inputs are parsed locally and behave exactly as before. Anything
 * else is handed to OmniFocus's own smart date parser through Omni
 * Automation, with the app's default due/defer/planned time applied when the
 * input carried no explicit time. Every write is read back and verified.
 */

import { describe, expect, test } from "bun:test";
import { type RunBridgeOptions, makeMutableJxaObject, runBridge } from "./bridge-harness.js";

function localIso(y: number, m: number, d: number, h = 0, min = 0): string {
	return new Date(y, m - 1, d, h, min).toISOString();
}

function docWithTask(overrides: Record<string, unknown> = {}, readonlyKeys: string[] = []) {
	const task = makeMutableJxaObject(
		{
			id: "task-1",
			name: "Buy milk",
			note: "",
			completed: false,
			flagged: false,
			dueDate: null,
			deferDate: null,
			plannedDate: null,
			estimatedMinutes: null,
			completionDate: null,
			tags: [],
			...overrides,
		},
		{ readonlyKeys },
	);
	const flattenedTasks = Object.assign(() => [task], {
		byId: (id: string) => (id === "task-1" ? task : null),
	});
	return { doc: { flattenedTasks }, task };
}

/** Omni Automation stub: a fixed parser table plus the app's default times. */
function parser(table: Record<string, string | null>): RunBridgeOptions & { calls: unknown[] } {
	const calls: unknown[] = [];
	return {
		calls,
		omniAutomation: (payload) => {
			calls.push(payload);
			const input = payload.input as string;
			return {
				ok: true,
				data: {
					date: input in table ? table[input] : null,
					defaults: { due: "18:00:00", defer: "08:00:00", planned: "09:30:00" },
				},
			};
		},
	};
}

function dueOf(task: Record<string, unknown>): Date | null {
	return (task.dueDate as () => Date | null)();
}

describe("task.update date resolution", () => {
	test("an ISO date is parsed locally without consulting OmniFocus", () => {
		const { doc, task } = docWithTask();
		const stub = parser({});
		const res = runBridge(doc, "task.update", { id: "task-1", due: "2026-09-10" }, stub);
		expect(res.ok).toBe(true);
		expect(stub.calls).toHaveLength(0);
		expect(dueOf(task)?.getTime()).toBe(new Date(2026, 8, 10, 0, 0).getTime());
		expect((res.data as { changes: string[] }).changes).toContain(
			"due: 2026-09-10 → 2026-09-10T00:00",
		);
	});

	test("an ISO date-time is parsed locally", () => {
		const { doc, task } = docWithTask();
		const res = runBridge(
			doc,
			"task.update",
			{ id: "task-1", due: "2026-09-10T14:30" },
			parser({}),
		);
		expect(res.ok).toBe(true);
		expect(dueOf(task)?.getTime()).toBe(new Date(2026, 8, 10, 14, 30).getTime());
	});

	test("a natural-language date is resolved by OmniFocus with the default due time applied", () => {
		const { doc, task } = docWithTask();
		const stub = parser({ tomorrow: localIso(2026, 9, 3) });
		const res = runBridge(doc, "task.update", { id: "task-1", due: "tomorrow" }, stub);
		expect(res.ok).toBe(true);
		expect(stub.calls).toEqual([{ input: "tomorrow" }]);
		expect(dueOf(task)?.getTime()).toBe(new Date(2026, 8, 3, 18, 0).getTime());
		expect((res.data as { changes: string[] }).changes).toContain(
			"due: tomorrow → 2026-09-03T18:00",
		);
	});

	test("defer and planned use their own default times", () => {
		const { doc, task } = docWithTask();
		const stub = parser({ mon: localIso(2026, 9, 7), fri: localIso(2026, 9, 4) });
		const res = runBridge(doc, "task.update", { id: "task-1", defer: "mon", planned: "fri" }, stub);
		expect(res.ok).toBe(true);
		expect((task.deferDate as () => Date)().getTime()).toBe(new Date(2026, 8, 7, 8, 0).getTime());
		expect((task.plannedDate as () => Date)().getTime()).toBe(
			new Date(2026, 8, 4, 9, 30).getTime(),
		);
	});

	test("an explicit time in the input is kept as parsed", () => {
		const { doc, task } = docWithTask();
		const stub = parser({ "fri 5pm": localIso(2026, 9, 4, 17, 0) });
		runBridge(doc, "task.update", { id: "task-1", due: "fri 5pm" }, stub);
		expect(dueOf(task)?.getTime()).toBe(new Date(2026, 8, 4, 17, 0).getTime());
	});

	test("an explicit midnight is not overridden by the default time", () => {
		const { doc, task } = docWithTask();
		const stub = parser({ "tomorrow 0:00": localIso(2026, 9, 3) });
		runBridge(doc, "task.update", { id: "task-1", due: "tomorrow 0:00" }, stub);
		expect(dueOf(task)?.getTime()).toBe(new Date(2026, 8, 3, 0, 0).getTime());
	});

	test("input OmniFocus cannot parse is an error naming the input", () => {
		const { doc, task } = docWithTask();
		const res = runBridge(doc, "task.update", { id: "task-1", due: "junk" }, parser({}));
		expect(res.ok).toBe(false);
		expect(res.error).toContain('Could not understand date "junk"');
		expect(dueOf(task)).toBeNull();
	});

	test("a failing Omni Automation call surfaces as an error", () => {
		const { doc } = docWithTask();
		const res = runBridge(
			doc,
			"task.update",
			{ id: "task-1", due: "tomorrow" },
			{
				omniAutomation: () => {
					throw new Error("boom");
				},
			},
		);
		expect(res.ok).toBe(false);
		expect(res.error).toContain("boom");
	});

	test("a date OmniFocus silently refuses to store is reported, not claimed", () => {
		const { doc } = docWithTask({}, ["dueDate"]);
		const res = runBridge(doc, "task.update", { id: "task-1", due: "2026-09-10" }, parser({}));
		expect(res.ok).toBe(false);
		expect(res.error).toContain("due date");
		expect(res.error).toContain("2026-09-10T00:00");
	});

	test("clear still removes the date", () => {
		const { doc, task } = docWithTask({ dueDate: new Date(2026, 8, 10) });
		const res = runBridge(doc, "task.update", { id: "task-1", due: "clear" }, parser({}));
		expect(res.ok).toBe(true);
		expect(dueOf(task)).toBeNull();
	});
});
