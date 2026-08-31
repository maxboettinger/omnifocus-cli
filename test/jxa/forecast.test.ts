/**
 * Regression tests for ops["forecast"] in src/jxa/bridge.js, run against
 * a stubbed OmniFocus document via the bridge harness.
 *
 * Covers the effective-status filter: tasks whose own `completed` flag is
 * false but that live inside a completed or dropped project (or parent
 * task) must not surface in any forecast bucket — OmniFocus's own Forecast
 * hides them via `effectively completed` / `effectively dropped`.
 */

import { describe, expect, test } from "bun:test";
import { makeElementArray, runBridge } from "./bridge-harness.js";

function forecastTask(
	name: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		name,
		id: `id-${name}`,
		note: "",
		dueDate: null,
		deferDate: null,
		plannedDate: null,
		flagged: false,
		estimatedMinutes: null,
		completed: false,
		effectivelyCompleted: false,
		effectivelyDropped: false,
		...overrides,
	};
}

function bucketNames(data: unknown, bucket: string): string[] {
	return ((data as Record<string, Array<{ name: string }>>)[bucket] ?? []).map((t) => t.name);
}

describe("forecast effective-status filtering", () => {
	const yesterday = new Date(Date.now() - 86400000);
	const tomorrow = new Date(Date.now() + 86400000);

	const doc = {
		flattenedTasks: makeElementArray([
			forecastTask("live-overdue", { dueDate: yesterday }),
			forecastTask("checked-off", {
				dueDate: yesterday,
				completed: true,
				effectivelyCompleted: true,
			}),
			// Incomplete child of a completed project: own flag still false.
			forecastTask("in-done-project", { dueDate: yesterday, effectivelyCompleted: true }),
			// Incomplete child of a dropped project.
			forecastTask("in-dropped-project", { dueDate: yesterday, effectivelyDropped: true }),
			forecastTask("live-upcoming", { dueDate: tomorrow }),
			forecastTask("planned-in-done-project", {
				plannedDate: new Date(),
				effectivelyCompleted: true,
			}),
		]),
	};

	test("tasks inside completed or dropped containers are excluded from all buckets", () => {
		const response = runBridge(doc, "forecast", {});
		expect(response.ok).toBe(true);
		const data = response.data as Record<string, unknown>;
		expect(bucketNames(data, "overdue")).toEqual(["live-overdue"]);
		expect(bucketNames(data, "due_today")).toEqual([]);
		expect(bucketNames(data, "planned_today")).toEqual([]);
		expect(bucketNames(data, "upcoming")).toEqual(["live-upcoming"]);
	});

	test("drag alerts and counts skip effectively completed tasks", () => {
		const response = runBridge(doc, "forecast", {});
		expect(response.ok).toBe(true);
		const meta = (response.data as { meta: Record<string, unknown> }).meta;
		const counts = meta.counts as Record<string, number>;
		expect(counts.overdue).toBe(1);
		const alerts = meta.dragAlerts as Array<{ name: string }>;
		expect(alerts.map((a) => a.name)).not.toContain("in-done-project");
	});

	test("falls back to own completed flag when effective properties are unavailable", () => {
		// Older OmniFocus dictionaries without effectively* batch getters must
		// not break the forecast — behavior degrades to the plain flag.
		const legacyDoc = {
			flattenedTasks: makeElementArray([
				{
					name: "legacy-overdue",
					id: "id-legacy",
					note: "",
					dueDate: yesterday,
					deferDate: null,
					plannedDate: null,
					flagged: false,
					estimatedMinutes: null,
					completed: false,
				},
			]),
		};
		const response = runBridge(legacyDoc, "forecast", {});
		expect(response.ok).toBe(true);
		expect(bucketNames(response.data, "overdue")).toEqual(["legacy-overdue"]);
	});
});
