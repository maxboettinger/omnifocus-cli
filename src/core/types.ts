/**
 * Core domain types for OmniFocus CLI.
 *
 * These types represent the canonical shapes returned by the JXA bridge.
 * All services and commands operate on these types.
 */

// ── Task ────────────────────────────────────────────────────────────────────

export interface OFTask {
	name: string;
	id: string;
	note: string;
	dueDate: string | null;
	deferDate: string | null;
	plannedDate: string | null;
	effectiveDueDate: string | null;
	effectiveDeferDate: string | null;
	effectivePlannedDate: string | null;
	flagged: boolean;
	effectiveFlagged: boolean;
	estimatedMinutes: number | null;
	completed: boolean;
	completionDate: string | null;
	creationDate: string | null;
	modificationDate: string | null;
	sequential: boolean;
	inInbox: boolean;
	blocked: boolean;
	project: string;
	parentTask: { id: string; name: string } | null;
	tags: string[];
	repetitionRule: { rule: string; method: string | null } | null;
	notifications?: OFTaskNotification[];
	childCount: number;
}

export interface OFTaskNotification {
	id: string;
	kind: "absolute" | "due-relative" | "unknown";
	absoluteFireDate: string | null;
	relativeFireOffsetSeconds: number | null;
	repeatIntervalSeconds: number | null;
	nextFireDate: string | null;
	initialFireDate: string | null;
	isSnoozed: boolean | null;
	usesFloatingTimeZone: boolean | null;
}

// ── Project ─────────────────────────────────────────────────────────────────

export interface OFProject {
	id: string;
	name: string;
	note: string;
	status: string;
	dueDate: string | null;
	deferDate: string | null;
	effectiveDueDate: string | null;
	effectiveDeferDate: string | null;
	flagged: boolean;
	sequential: boolean;
	completed: boolean;
	completionDate: string | null;
	creationDate: string | null;
	modificationDate: string | null;
	parentFolder: string | null;
	tags: string[];
	taskCount: number;
	completedTaskCount: number;
}

export interface OFProjectCompact {
	id: string;
	name: string;
	status: string;
	taskCount: number;
}

// ── Tag ─────────────────────────────────────────────────────────────────────

export interface OFTag {
	name: string;
	id: string;
	taskCount?: number;
	activeTaskCount?: number;
}

// ── Folder ──────────────────────────────────────────────────────────────────

export interface OFFolder {
	id: string;
	name: string;
	parentFolder: string | null;
	projectCount?: number;
}

// ── Bridge protocol ─────────────────────────────────────────────────────────

export interface BridgeCandidateDetail {
	id?: string;
	name: string;
	project?: string;
}

export type BridgeCandidate = string | BridgeCandidateDetail;

/** Every bridge command follows this shape. */
export interface BridgeCommand {
	op: string;
	params: Record<string, unknown>;
}

/** Successful bridge response. */
export interface BridgeSuccess<T = unknown> {
	ok: true;
	data: T;
}

/** Failed bridge response. */
export interface BridgeError {
	ok: false;
	error: string;
	candidates?: BridgeCandidate[];
}

export type BridgeResponse<T = unknown> = BridgeSuccess<T> | BridgeError;

// ── Task mutation options ───────────────────────────────────────────────────

/** Payload of the `task.complete` op. */
export interface TaskCompleteResult {
	id: string;
	name: string;
	/** "completed" or "uncompleted". */
	action: string;
	task: OFTask;
}

export interface TaskCreateOptions {
	name: string;
	note?: string;
	due?: string;
	defer?: string;
	planned?: string;
	tags?: string[];
	flag?: boolean;
	estimate?: number;
	/** Create inside this project. Mutually exclusive with parent/parentId. */
	project?: string;
	/** Create as a subtask of this task (short id, name or OmniFocus id). */
	parent?: string;
	/** Create as a subtask of this task id. */
	parentId?: string;
	sequential?: boolean;
	repeat?: string;
	repeatMethod?: string;
}

export interface TaskUpdateOptions {
	id?: string;
	query?: string;
	name?: string;
	note?: string;
	noteAppend?: string;
	due?: string | "clear";
	defer?: string | "clear";
	planned?: string | "clear";
	flag?: boolean;
	unflag?: boolean;
	estimate?: number | "clear";
	tags?: string[];
	removeTags?: string[];
	project?: string;
	sequential?: boolean;
	parallel?: boolean;
	repeat?: string | "clear";
	repeatMethod?: string;
	complete?: boolean;
	incomplete?: boolean;
}

export interface TaskNotificationListOptions {
	query?: string;
	id?: string;
}

export interface TaskNotificationAddOptions {
	query?: string;
	id?: string;
	kind: "absolute" | "due-relative";
	at?: string;
	offsetSeconds?: number;
	repeatSeconds?: number;
}

export interface TaskNotificationUpdateOptions {
	query?: string;
	id?: string;
	notificationId: string;
	at?: string;
	offsetSeconds?: number;
	repeatSeconds?: number | "clear";
}

export interface TaskNotificationDeleteOptions {
	query?: string;
	id?: string;
	notificationId: string;
}

export interface TaskNotificationClearOptions {
	query?: string;
	id?: string;
	confirm?: boolean;
}

// ── Project mutation options ────────────────────────────────────────────────

export interface ProjectCreateOptions {
	name: string;
	folder?: string;
	status?: string;
	sequential?: boolean;
	note?: string;
	flag?: boolean;
}

export interface ProjectUpdateOptions {
	query?: string;
	id?: string;
	name?: string;
	note?: string;
	noteAppend?: string;
	status?: string;
	folder?: string;
	sequential?: boolean;
	parallel?: boolean;
	flag?: boolean;
	unflag?: boolean;
}

// ── Inbox processing ────────────────────────────────────────────────────────

export interface InboxProcessOptions {
	id: string;
	name?: string;
	note?: string;
	noteAppend?: string;
	project?: string;
	tags?: string[];
	removeTags?: string[];
	due?: string | "clear";
	defer?: string | "clear";
	planned?: string | "clear";
	estimate?: number | "clear";
	flag?: boolean;
	unflag?: boolean;
	sequential?: boolean;
	parallel?: boolean;
	repeat?: string | "clear";
	repeatMethod?: string;
	complete?: boolean;
	delete?: boolean;
	dryRun?: boolean;
	confirm?: boolean;
}

// ── List/filter options ─────────────────────────────────────────────────────

export type TaskFilter = "inbox" | "available" | "flagged" | "due-soon" | "overdue" | "all";

export interface TaskListOptions {
	filter?: TaskFilter;
	limit?: number;
	includeNotifications?: boolean;
}

export interface ProjectListOptions {
	search?: string;
	status?: string;
	folder?: string;
	count?: boolean;
	full?: boolean;
	activeOnly?: boolean;
	limit?: number;
}

export interface TagListOptions {
	search?: string;
	count?: boolean;
	activeOnly?: boolean;
	limit?: number;
}

export interface FolderListOptions {
	search?: string;
	count?: boolean;
	limit?: number;
}

// ── Forecast ────────────────────────────────────────────────────────────────

export interface ForecastOptions {
	days?: number;
	includeFlagged?: boolean;
	includeAvailable?: boolean;
}

export interface DragAlert {
	name: string;
	id: string;
	daysOverdue: number;
	suggestion: string;
}

export interface ForecastResult {
	meta: {
		generatedAt: string;
		today: string;
		upcomingDays: number;
		totalEstimatedMinutes: number;
		counts: {
			overdue: number;
			dueToday: number;
			plannedToday: number;
			deferredToday: number;
			flagged: number;
			upcoming: number;
			availableNext: number;
		};
		dragAlerts: DragAlert[];
	};
	overdue: OFTask[];
	due_today: OFTask[];
	planned_today: OFTask[];
	deferred_today: OFTask[];
	flagged: OFTask[];
	upcoming: OFTask[];
	available_next: OFTask[];
}

// ── Review ──────────────────────────────────────────────────────────────────

export interface ReviewOptions {
	days?: number;
}

export interface ReviewResult {
	meta: {
		generatedAt: string;
		periodStart: string;
		periodEnd: string;
		daysReviewed: number;
	};
	completedTasks: OFTask[];
	summary: {
		totalCompleted: number;
		byProject: Record<string, number>;
		byDay: Record<string, number>;
		totalEstimatedMinutes: number;
	};
	projectProgress: Array<{
		name: string;
		taskCount: number;
		completedCount: number;
		percentage: number;
	}>;
}

// ── Stats ───────────────────────────────────────────────────────────────────

export interface StatsResult {
	tasks: {
		total: number;
		incomplete: number;
		completed: number;
		inbox: number;
		flagged: number;
		overdue: number;
		dueSoon: number;
		available: number;
		blocked: number;
		withEstimates: number;
		totalEstimatedMinutes: number;
		repeating: number;
		sequential: number;
	};
	projects: {
		total: number;
		active: number;
		onHold: number;
		completed: number;
		dropped: number;
	};
}

// ── Bulk operations ─────────────────────────────────────────────────────────

export interface BulkCreateInput {
	name: string;
	note?: string;
	due?: string;
	defer?: string;
	planned?: string;
	flag?: boolean;
	estimate?: number;
	project?: string;
	sequential?: boolean;
	repeat?: string;
	repeatMethod?: string;
	tags?: string[];
}

export interface BulkUpdateInput {
	id: string;
	name?: string;
	note?: string;
	noteAppend?: string;
	due?: string;
	defer?: string;
	planned?: string;
	flag?: boolean;
	unflag?: boolean;
	estimate?: number;
	tags?: string[];
	removeTags?: string[];
	project?: string;
	sequential?: boolean;
	parallel?: boolean;
	repeat?: string;
	repeatMethod?: string;
	complete?: boolean;
	incomplete?: boolean;
}

export interface BulkResult {
	ok: boolean;
	id?: string;
	name?: string;
	error?: string;
	changes?: string[];
	warnings?: string[];
	task?: OFTask;
}

// ── Collect completed ───────────────────────────────────────────────────────

export interface CollectedTask {
	omnifocus_id: string;
	name: string;
	project: string;
	completion_date: string;
	tags: string[];
	estimated_minutes: number | null;
	note: string;
}

// ── Client interface ────────────────────────────────────────────────────────

/**
 * Abstraction over the OmniFocus JXA bridge.
 * Services depend on this interface, never on the bridge directly.
 * In tests, inject a mock implementation.
 */
export interface OmniFocusClient {
	// Tasks
	createTask(opts: TaskCreateOptions): Promise<
		BridgeResponse<{
			id: string;
			name: string;
			task: OFTask;
			parent?: { id: string; name: string; project: string };
			changes?: string[];
			warnings?: string[];
		}>
	>;
	getTask(
		query: string,
		opts?: { searchCompleted?: boolean; includeNotifications?: boolean },
	): Promise<BridgeResponse<OFTask>>;
	updateTask(
		opts: TaskUpdateOptions,
	): Promise<BridgeResponse<{ id: string; changes: string[]; task: OFTask }>>;
	completeTask(
		query: string,
		opts?: { id?: string; incomplete?: boolean },
	): Promise<BridgeResponse<TaskCompleteResult>>;
	listTasks(opts: TaskListOptions): Promise<BridgeResponse<OFTask[]>>;
	searchTasks(query: string, limit?: number): Promise<BridgeResponse<OFTask[]>>;
	applyTag(
		query: string,
		tags: string[],
		opts?: { id?: string },
	): Promise<BridgeResponse<{ id: string; name: string; applied: string[]; task: OFTask }>>;
	deleteTask(
		query: string,
		opts?: { id?: string; confirm?: boolean },
	): Promise<BridgeResponse<{ id: string; name: string; action: string }>>;
	listTaskNotifications(
		opts: TaskNotificationListOptions,
	): Promise<
		BridgeResponse<{ taskId: string; taskName: string; notifications: OFTaskNotification[] }>
	>;
	addTaskNotification(opts: TaskNotificationAddOptions): Promise<
		BridgeResponse<{
			taskId: string;
			taskName: string;
			notification: OFTaskNotification;
			notifications: OFTaskNotification[];
		}>
	>;
	updateTaskNotification(opts: TaskNotificationUpdateOptions): Promise<
		BridgeResponse<{
			taskId: string;
			taskName: string;
			notification: OFTaskNotification;
			notifications: OFTaskNotification[];
		}>
	>;
	deleteTaskNotification(opts: TaskNotificationDeleteOptions): Promise<
		BridgeResponse<{
			taskId: string;
			taskName: string;
			deletedId: string;
			notifications: OFTaskNotification[];
		}>
	>;
	clearTaskNotifications(opts: TaskNotificationClearOptions): Promise<
		BridgeResponse<{
			taskId: string;
			taskName: string;
			cleared: number;
			notifications: OFTaskNotification[];
		}>
	>;

	// Projects
	createProject(
		opts: ProjectCreateOptions,
	): Promise<BridgeResponse<{ id: string; name: string; project: OFProject }>>;
	getProject(
		query: string,
		opts?: { id?: string },
	): Promise<BridgeResponse<OFProject & { overdueCount?: number; completionPercentage?: number }>>;
	listProjects(
		opts: ProjectListOptions,
	): Promise<BridgeResponse<(string | OFProjectCompact | OFProject)[]>>;
	updateProject(
		opts: ProjectUpdateOptions,
	): Promise<BridgeResponse<{ id: string; changes: string[]; project: OFProject }>>;
	renameProject(
		query: string,
		newName: string,
		opts?: { id?: string },
	): Promise<BridgeResponse<{ id: string; oldName: string; newName: string; project: OFProject }>>;
	deleteProject(
		query: string,
		opts?: { id?: string; confirm?: boolean },
	): Promise<BridgeResponse<{ id: string; name: string; action: string }>>;

	// Tags
	createTag(name: string): Promise<BridgeResponse<{ id: string; name: string }>>;
	listTags(opts: TagListOptions): Promise<BridgeResponse<(string | OFTag)[]>>;
	renameTag(
		oldName: string,
		newName: string,
	): Promise<BridgeResponse<{ oldName: string; newName: string }>>;
	deleteTag(
		name: string,
		opts?: { confirm?: boolean },
	): Promise<BridgeResponse<{ name: string; action: string }>>;
	listTasksByTag(tagName: string, limit?: number): Promise<BridgeResponse<OFTask[]>>;

	// Folders
	createFolder(name: string, opts?: { parent?: string }): Promise<BridgeResponse<OFFolder>>;
	listFolders(opts: FolderListOptions): Promise<BridgeResponse<(string | OFFolder)[]>>;

	// Inbox
	listInbox(limit?: number, opts?: { newestFirst?: boolean }): Promise<BridgeResponse<OFTask[]>>;
	addInbox(opts: TaskCreateOptions): Promise<
		BridgeResponse<{
			id: string;
			name: string;
			task: OFTask;
			changes?: string[];
			warnings?: string[];
		}>
	>;
	processInbox(
		opts: InboxProcessOptions,
	): Promise<BridgeResponse<{ id: string; changes: string[]; task?: OFTask }>>;

	// Views/Reports
	forecast(opts: ForecastOptions): Promise<BridgeResponse<ForecastResult>>;
	review(opts: ReviewOptions): Promise<BridgeResponse<ReviewResult>>;
	stats(): Promise<BridgeResponse<StatsResult>>;

	// Bulk
	bulkCreate(tasks: BulkCreateInput[]): Promise<BridgeResponse<BulkResult[]>>;
	bulkUpdate(updates: BulkUpdateInput[]): Promise<BridgeResponse<BulkResult[]>>;
	bulkComplete(
		ids: string[],
		opts?: { incomplete?: boolean },
	): Promise<BridgeResponse<BulkResult[]>>;

	// Data
	collectCompleted(days?: number): Promise<BridgeResponse<CollectedTask[]>>;
}

// ── Output options ──────────────────────────────────────────────────────────

export type OutputFormat = "human" | "json";
