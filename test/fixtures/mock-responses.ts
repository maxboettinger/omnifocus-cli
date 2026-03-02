/**
 * Shared mock responses for testing.
 * These match the shapes returned by bridge.js.
 */

import type { BridgeResponse, OFProject, OFTask, StatsResult } from "../../src/core/types.js";

export const MOCK_TASK: OFTask = {
	name: "Buy groceries",
	id: "task-abc123",
	note: "Milk, eggs, bread",
	dueDate: "2026-03-05T00:00:00.000Z",
	deferDate: null,
	plannedDate: null,
	effectiveDueDate: "2026-03-05T00:00:00.000Z",
	effectiveDeferDate: null,
	effectivePlannedDate: null,
	flagged: true,
	effectiveFlagged: true,
	estimatedMinutes: 30,
	completed: false,
	completionDate: null,
	creationDate: "2026-01-15T10:00:00.000Z",
	modificationDate: "2026-02-20T15:30:00.000Z",
	sequential: false,
	inInbox: false,
	blocked: false,
	project: "Errands",
	parentTask: null,
	tags: ["🔋 Medium", "🏡 Daheim"],
	repetitionRule: null,
	childCount: 0,
};

export const MOCK_PROJECT: OFProject = {
	id: "proj-abc123",
	name: "Home Renovation",
	note: "Full kitchen remodel",
	status: "active",
	dueDate: "2026-06-01T00:00:00.000Z",
	deferDate: null,
	effectiveDueDate: "2026-06-01T00:00:00.000Z",
	effectiveDeferDate: null,
	flagged: false,
	sequential: true,
	completed: false,
	completionDate: null,
	creationDate: "2026-01-01T00:00:00.000Z",
	modificationDate: "2026-02-15T12:00:00.000Z",
	parentFolder: "Personal",
	tags: [],
	taskCount: 15,
	completedTaskCount: 5,
};

export const MOCK_STATS: StatsResult = {
	tasks: {
		total: 500,
		incomplete: 200,
		completed: 300,
		inbox: 15,
		flagged: 10,
		overdue: 3,
		dueSoon: 8,
		available: 150,
		blocked: 50,
		withEstimates: 80,
		totalEstimatedMinutes: 4800,
		repeating: 20,
		sequential: 30,
	},
	projects: {
		total: 25,
		active: 15,
		onHold: 5,
		completed: 3,
		dropped: 2,
	},
};

export function successResponse<T>(data: T): BridgeResponse<T> {
	return { ok: true, data };
}

export function errorResponse(error: string, candidates?: string[]): BridgeResponse<never> {
	return { ok: false, error, candidates };
}
