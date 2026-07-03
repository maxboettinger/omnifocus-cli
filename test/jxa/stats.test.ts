/**
 * Tests for ops["stats"] in src/jxa/bridge.js via the bridge harness.
 */

import { describe, expect, test } from "bun:test";
import { makeElementArray, runBridge } from "./bridge-harness.js";

interface StatsData {
	tasks: Record<string, number>;
	projects: Record<string, number>;
}

function task(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		completed: false,
		flagged: false,
		dueDate: null,
		estimatedMinutes: null,
		blocked: false,
		repetitionRule: null,
		sequential: false,
		...overrides,
	};
}

const now = Date.now();
const yesterday = new Date(now - 86400000);
const tomorrow = new Date(now + 86400000);
const nextWeek = new Date(now + 7 * 86400000);

describe("stats", () => {
	const doc = {
		flattenedTasks: makeElementArray([
			task({ completed: true }),
			task({ flagged: true, dueDate: yesterday, estimatedMinutes: 30 }),
			task({ dueDate: tomorrow, blocked: true }),
			task({ dueDate: nextWeek, repetitionRule: { rule: "weekly" }, sequential: true }),
		]),
		inboxTasks: makeElementArray([task({ completed: true }), task({ completed: true }), task({})]),
		flattenedProjects: makeElementArray([
			{ status: "active status" },
			{ status: "on hold status" },
			{ status: "done status" },
			{ status: "dropped status" },
		]),
	};

	test("aggregates task counts from batch properties", () => {
		const response = runBridge(doc, "stats");
		expect(response.ok).toBe(true);
		const data = response.data as StatsData;
		expect(data.tasks.total).toBe(4);
		expect(data.tasks.completed).toBe(1);
		expect(data.tasks.incomplete).toBe(3);
		expect(data.tasks.flagged).toBe(1);
		expect(data.tasks.overdue).toBe(1);
		expect(data.tasks.dueSoon).toBe(1);
		expect(data.tasks.blocked).toBe(1);
		expect(data.tasks.available).toBe(2);
		expect(data.tasks.withEstimates).toBe(1);
		expect(data.tasks.totalEstimatedMinutes).toBe(30);
		expect(data.tasks.repeating).toBe(1);
		expect(data.tasks.sequential).toBe(1);
	});

	test("inbox count excludes completed inbox tasks", () => {
		const response = runBridge(doc, "stats");
		expect(response.ok).toBe(true);
		expect((response.data as StatsData).tasks.inbox).toBe(1);
	});

	test("project counts bucket by status", () => {
		const response = runBridge(doc, "stats");
		expect(response.ok).toBe(true);
		const data = response.data as StatsData;
		expect(data.projects).toEqual({ total: 4, active: 1, onHold: 1, completed: 1, dropped: 1 });
	});
});
