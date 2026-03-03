/**
 * OmniFocusClient implementation backed by the JXA bridge.
 *
 * This is the real implementation used in production. Tests inject
 * a mock client that satisfies the same OmniFocusClient interface.
 */

import { executeBridge } from "./bridge.js";
import { BridgeError } from "./errors.js";
import type {
	BridgeResponse,
	BulkCreateInput,
	BulkUpdateInput,
	FolderListOptions,
	ForecastOptions,
	InboxProcessOptions,
	OmniFocusClient,
	ProjectCreateOptions,
	ProjectListOptions,
	ProjectUpdateOptions,
	ReviewOptions,
	SubtaskCreateOptions,
	TagListOptions,
	TaskCreateOptions,
	TaskListOptions,
	TaskNotificationAddOptions,
	TaskNotificationClearOptions,
	TaskNotificationDeleteOptions,
	TaskNotificationListOptions,
	TaskNotificationUpdateOptions,
	TaskUpdateOptions,
} from "./types.js";

/**
 * Unwrap a BridgeResponse: return data on success, throw BridgeError on failure.
 */
export function unwrapBridgeResponse<T>(response: BridgeResponse<T>): T {
	if (!response.ok) {
		throw new BridgeError(response.error, response.candidates);
	}
	return response.data;
}

function cmd(op: string, params: Record<string, unknown> = {}) {
	return { op, params };
}

export function createClient(): OmniFocusClient {
	return {
		// ── Tasks ──────────────────────────────────────────────────────
		async createTask(opts: TaskCreateOptions) {
			return executeBridge(cmd("task.create", opts as unknown as Record<string, unknown>));
		},

		async getTask(
			query: string,
			opts?: { searchCompleted?: boolean; includeNotifications?: boolean },
		) {
			return executeBridge(cmd("task.get", { query, ...opts }));
		},

		async updateTask(opts: TaskUpdateOptions) {
			return executeBridge(cmd("task.update", opts as unknown as Record<string, unknown>));
		},

		async completeTask(query: string, opts?: { id?: string; incomplete?: boolean }) {
			return executeBridge(cmd("task.complete", { query, ...opts }));
		},

		async listTasks(opts: TaskListOptions) {
			return executeBridge(cmd("task.list", opts as unknown as Record<string, unknown>));
		},

		async searchTasks(query: string, limit?: number) {
			return executeBridge(cmd("task.search", { query, limit }));
		},

		async createSubtask(opts: SubtaskCreateOptions) {
			return executeBridge(cmd("task.subtask", opts as unknown as Record<string, unknown>));
		},

		async applyTag(query: string, tags: string[], opts?: { id?: string }) {
			return executeBridge(cmd("task.applyTag", { query, tags, ...opts }));
		},

		async deleteTask(query: string, opts?: { id?: string; confirm?: boolean }) {
			return executeBridge(cmd("task.delete", { query, ...opts }));
		},

		async listTaskNotifications(opts: TaskNotificationListOptions) {
			return executeBridge(
				cmd("task.notification.list", opts as unknown as Record<string, unknown>),
			);
		},

		async addTaskNotification(opts: TaskNotificationAddOptions) {
			return executeBridge(
				cmd("task.notification.add", opts as unknown as Record<string, unknown>),
			);
		},

		async updateTaskNotification(opts: TaskNotificationUpdateOptions) {
			return executeBridge(
				cmd("task.notification.update", opts as unknown as Record<string, unknown>),
			);
		},

		async deleteTaskNotification(opts: TaskNotificationDeleteOptions) {
			return executeBridge(
				cmd("task.notification.delete", opts as unknown as Record<string, unknown>),
			);
		},

		async clearTaskNotifications(opts: TaskNotificationClearOptions) {
			return executeBridge(
				cmd("task.notification.clear", opts as unknown as Record<string, unknown>),
			);
		},

		// ── Projects ──────────────────────────────────────────────────

		async createProject(opts: ProjectCreateOptions) {
			return executeBridge(cmd("project.create", opts as unknown as Record<string, unknown>));
		},

		async getProject(query: string, opts?: { id?: string }) {
			return executeBridge(cmd("project.get", { query, ...opts }));
		},

		async listProjects(opts: ProjectListOptions) {
			return executeBridge(cmd("project.list", opts as unknown as Record<string, unknown>));
		},

		async updateProject(opts: ProjectUpdateOptions) {
			return executeBridge(cmd("project.update", opts as unknown as Record<string, unknown>));
		},

		async renameProject(query: string, newName: string, opts?: { id?: string }) {
			return executeBridge(cmd("project.rename", { query, newName, ...opts }));
		},

		async deleteProject(query: string, opts?: { id?: string; confirm?: boolean }) {
			return executeBridge(cmd("project.delete", { query, ...opts }));
		},

		// ── Tags ──────────────────────────────────────────────────────

		async createTag(name: string) {
			return executeBridge(cmd("tag.create", { name }));
		},

		async listTags(opts: TagListOptions) {
			return executeBridge(cmd("tag.list", opts as unknown as Record<string, unknown>));
		},

		async renameTag(oldName: string, newName: string) {
			return executeBridge(cmd("tag.rename", { oldName, newName }));
		},

		async deleteTag(name: string, opts?: { confirm?: boolean }) {
			return executeBridge(cmd("tag.delete", { name, ...opts }));
		},

		async listTasksByTag(tagName: string, limit?: number) {
			return executeBridge(cmd("tag.tasks", { tagName, limit }));
		},

		// ── Folders ───────────────────────────────────────────────────

		async createFolder(name: string, opts?: { parent?: string }) {
			return executeBridge(cmd("folder.create", { name, ...opts }));
		},

		async listFolders(opts: FolderListOptions) {
			return executeBridge(cmd("folder.list", opts as unknown as Record<string, unknown>));
		},

		// ── Inbox ─────────────────────────────────────────────────────

		async listInbox(limit?: number) {
			return executeBridge(cmd("inbox.list", { limit }));
		},

		async addInbox(opts: TaskCreateOptions) {
			return executeBridge(cmd("inbox.add", opts as unknown as Record<string, unknown>));
		},

		async processInbox(opts: InboxProcessOptions) {
			return executeBridge(cmd("inbox.process", opts as unknown as Record<string, unknown>));
		},

		// ── Views/Reports ─────────────────────────────────────────────

		async forecast(opts: ForecastOptions) {
			return executeBridge(cmd("forecast", opts as unknown as Record<string, unknown>), {
				timeoutMs: 60_000,
			});
		},

		async review(opts: ReviewOptions) {
			return executeBridge(cmd("review", opts as unknown as Record<string, unknown>), {
				timeoutMs: 60_000,
			});
		},

		async stats() {
			return executeBridge(cmd("stats"), { timeoutMs: 60_000 });
		},

		// ── Bulk ──────────────────────────────────────────────────────

		async bulkCreate(tasks: BulkCreateInput[]) {
			return executeBridge(cmd("bulk.create", { tasks }), {
				timeoutMs: 120_000,
			});
		},

		async bulkUpdate(updates: BulkUpdateInput[]) {
			return executeBridge(cmd("bulk.update", { updates }), {
				timeoutMs: 120_000,
			});
		},

		async bulkComplete(ids: string[], opts?: { incomplete?: boolean }) {
			return executeBridge(cmd("bulk.complete", { ids, ...opts }), {
				timeoutMs: 120_000,
			});
		},

		// ── Data ──────────────────────────────────────────────────────

		async collectCompleted(days?: number) {
			return executeBridge(cmd("collect", { days }));
		},
	};
}
