/**
 * Shared mock responses for testing.
 * These match the shapes returned by bridge.js.
 */

import type {
	BridgeResponse,
	CreateTreeResult,
	OFProject,
	OFTask,
	StatsResult,
	TaskContext,
} from "../../src/core/types.js";

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
	tags: ["errand", "home"],
	repetitionRule: null,
	notifications: [
		{
			id: "notif-1",
			kind: "absolute",
			absoluteFireDate: "2026-03-04T09:00:00.000Z",
			relativeFireOffsetSeconds: null,
			repeatIntervalSeconds: 3600,
			nextFireDate: "2026-03-04T10:00:00.000Z",
			initialFireDate: "2026-03-04T09:00:00.000Z",
			isSnoozed: false,
			usesFloatingTimeZone: false,
		},
	],
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

export const MOCK_TASK_CONTEXT: TaskContext = {
	task: MOCK_TASK,
	ancestors: [],
	project: MOCK_PROJECT,
	children: [
		{
			...MOCK_TASK,
			id: "task-child-1",
			name: "Write shopping list",
			completed: true,
			completionDate: "2026-03-01T10:00:00.000Z",
			tags: [],
			flagged: false,
			estimatedMinutes: 5,
			children: [],
		},
	],
	siblings: [{ id: "task-sib-1", name: "Return library books", completed: false }],
	tags: ["errand", "home", "@computer"],
};

export const MOCK_CREATE_TREE_RESULT: CreateTreeResult = {
	parent: { id: MOCK_TASK.id, name: MOCK_TASK.name, project: MOCK_TASK.project },
	created: [
		{ key: "1", ok: true, id: "new-1", name: "Open the shopping list app", warnings: [] },
		{ key: "2", ok: true, id: "new-2", name: "Add milk and eggs", warnings: [] },
	],
	warnings: [],
};
