/**
 * Shared mock OmniFocusClient factory for integration tests.
 *
 * Every method resolves with a plausible success response so tests can
 * exercise the full command → client → output flow without OmniFocus.
 */

import { mock } from "bun:test";
import type { OmniFocusClient } from "../../src/core/types.js";
import { MOCK_PROJECT, MOCK_STATS, MOCK_TASK, successResponse } from "./mock-responses.js";

export function createMockClient(): OmniFocusClient {
	const mockNotification = (MOCK_TASK.notifications ?? [])[0] ?? {
		id: "notif-1",
		kind: "absolute" as const,
		absoluteFireDate: "2026-03-04T09:00:00.000Z",
		relativeFireOffsetSeconds: null,
		repeatIntervalSeconds: null,
		nextFireDate: null,
		initialFireDate: null,
		isSnoozed: false,
		usesFloatingTimeZone: false,
	};
	return {
		createTask: mock(() =>
			Promise.resolve(successResponse({ id: MOCK_TASK.id, name: MOCK_TASK.name, task: MOCK_TASK })),
		),
		getTask: mock(() => Promise.resolve(successResponse(MOCK_TASK))),
		updateTask: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_TASK.id, changes: ["due: 2026-03-10"], task: MOCK_TASK }),
			),
		),
		completeTask: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_TASK.id,
					name: MOCK_TASK.name,
					action: "completed",
					task: MOCK_TASK,
				}),
			),
		),
		listTasks: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),
		searchTasks: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),
		applyTag: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_TASK.id,
					name: MOCK_TASK.name,
					applied: ["urgent"],
					task: MOCK_TASK,
				}),
			),
		),
		deleteTask: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_TASK.id, name: MOCK_TASK.name, action: "deleted" }),
			),
		),
		listTaskNotifications: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					notifications: MOCK_TASK.notifications ?? [],
				}),
			),
		),
		addTaskNotification: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					notification: mockNotification,
					notifications: MOCK_TASK.notifications ?? [],
				}),
			),
		),
		updateTaskNotification: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					notification: mockNotification,
					notifications: MOCK_TASK.notifications ?? [],
				}),
			),
		),
		deleteTaskNotification: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					deletedId: "notif-1",
					notifications: [],
				}),
			),
		),
		clearTaskNotifications: mock(() =>
			Promise.resolve(
				successResponse({
					taskId: MOCK_TASK.id,
					taskName: MOCK_TASK.name,
					cleared: 1,
					notifications: [],
				}),
			),
		),

		createProject: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_PROJECT.id, name: MOCK_PROJECT.name, project: MOCK_PROJECT }),
			),
		),
		getProject: mock(() =>
			Promise.resolve(
				successResponse({ ...MOCK_PROJECT, overdueCount: 0, completionPercentage: 33 }),
			),
		),
		listProjects: mock(() => Promise.resolve(successResponse(["Project A", "Project B"]))),
		updateProject: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_PROJECT.id,
					changes: ["status → onhold"],
					project: MOCK_PROJECT,
				}),
			),
		),
		renameProject: mock(() =>
			Promise.resolve(
				successResponse({
					id: MOCK_PROJECT.id,
					oldName: "Old",
					newName: "New",
					project: MOCK_PROJECT,
				}),
			),
		),
		deleteProject: mock(() =>
			Promise.resolve(
				successResponse({ id: MOCK_PROJECT.id, name: MOCK_PROJECT.name, action: "deleted" }),
			),
		),

		createTag: mock(() => Promise.resolve(successResponse({ id: "tag-1", name: "urgent" }))),
		listTags: mock(() => Promise.resolve(successResponse(["urgent", "errand"]))),
		renameTag: mock(() => Promise.resolve(successResponse({ oldName: "old", newName: "new" }))),
		deleteTag: mock(() => Promise.resolve(successResponse({ name: "old", action: "deleted" }))),
		listTasksByTag: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),

		createFolder: mock(() =>
			Promise.resolve(successResponse({ id: "folder-1", name: "Personal", parentFolder: null })),
		),
		listFolders: mock(() => Promise.resolve(successResponse(["Personal", "Work"]))),

		listInbox: mock(() => Promise.resolve(successResponse([MOCK_TASK]))),
		processInbox: mock(() =>
			Promise.resolve(
				successResponse({ id: "inbox-1", changes: ["moved to project"], task: MOCK_TASK }),
			),
		),

		forecast: mock(() => Promise.resolve(successResponse({} as never))),
		review: mock(() => Promise.resolve(successResponse({} as never))),
		stats: mock(() => Promise.resolve(successResponse(MOCK_STATS))),

		bulkCreate: mock(() => Promise.resolve(successResponse([]))),
		bulkUpdate: mock(() => Promise.resolve(successResponse([]))),
		bulkComplete: mock(() => Promise.resolve(successResponse([]))),

		collectCompleted: mock(() => Promise.resolve(successResponse([]))),
	};
}
