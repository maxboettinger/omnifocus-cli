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
	childCount: number;
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
	candidates?: string[];
}

export type BridgeResponse<T = unknown> = BridgeSuccess<T> | BridgeError;

// ── Task mutation options ───────────────────────────────────────────────────

export interface TaskCreateOptions {
	name: string;
	note?: string;
	due?: string;
	defer?: string;
	planned?: string;
	tags?: string[];
	flag?: boolean;
	estimate?: number;
	project?: string;
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

export interface SubtaskCreateOptions {
	name: string;
	parentId?: string;
	parent?: string;
	note?: string;
	due?: string;
	defer?: string;
	planned?: string;
	tags?: string[];
	flag?: boolean;
	estimate?: number;
	sequential?: boolean;
	repeat?: string;
	repeatMethod?: string;
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
}

// ── List/filter options ─────────────────────────────────────────────────────

export type TaskFilter = "inbox" | "available" | "flagged" | "due-soon" | "overdue" | "all";

export interface TaskListOptions {
	filter?: TaskFilter;
	limit?: number;
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
	status?: string;
	count?: boolean;
	limit?: number;
}

// ── Forecast ────────────────────────────────────────────────────────────────

export interface ForecastOptions {
	days?: number;
	includeFlagged?: boolean;
	includeAvailable?: boolean;
}

export interface SpoonBudget {
	baseline: number;
	planned: number;
	remaining: number;
	overBudget: boolean;
	breakdown: Record<string, number>;
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
		spoonBudget: SpoonBudget;
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
	completedTasks: Array<OFTask & { spoonCost: number | null; spoonEmoji: string | null }>;
	summary: {
		totalCompleted: number;
		byPurpose: Record<string, number>;
		bySpoon: Record<string, number>;
		byProject: Record<string, number>;
		byDay: Record<string, number>;
		totalEstimatedMinutes: number;
		totalSpoons: number;
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
	spoon_cost: number | null;
	spoon_emoji: string | null;
	priority: string | null;
	rigidity: string | null;
}

// ── Client interface ────────────────────────────────────────────────────────

/**
 * Abstraction over the OmniFocus JXA bridge.
 * Services depend on this interface, never on the bridge directly.
 * In tests, inject a mock implementation.
 */
export interface OmniFocusClient {
	// Tasks
	createTask(
		opts: TaskCreateOptions,
	): Promise<BridgeResponse<{ id: string; name: string; task: OFTask }>>;
	getTask(query: string, opts?: { searchCompleted?: boolean }): Promise<BridgeResponse<OFTask>>;
	updateTask(
		opts: TaskUpdateOptions,
	): Promise<BridgeResponse<{ id: string; changes: string[]; task: OFTask }>>;
	completeTask(
		query: string,
		opts?: { id?: string; incomplete?: boolean },
	): Promise<BridgeResponse<{ id: string; name: string; action: string; task: OFTask }>>;
	listTasks(opts: TaskListOptions): Promise<BridgeResponse<OFTask[]>>;
	searchTasks(query: string, limit?: number): Promise<BridgeResponse<OFTask[]>>;
	createSubtask(opts: SubtaskCreateOptions): Promise<
		BridgeResponse<{
			id: string;
			name: string;
			task: OFTask;
			parent: { id: string; name: string; project: string };
		}>
	>;
	applyTag(
		query: string,
		tags: string[],
		opts?: { id?: string },
	): Promise<BridgeResponse<{ id: string; name: string; applied: string[]; task: OFTask }>>;

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
	listInbox(limit?: number): Promise<BridgeResponse<OFTask[]>>;
	addInbox(
		opts: TaskCreateOptions,
	): Promise<BridgeResponse<{ id: string; name: string; task: OFTask }>>;
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
