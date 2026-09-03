/**
 * Output formatting for OmniFocus CLI.
 *
 * Handles two modes:
 * - human: colored, tabular, designed for TTY
 * - json: raw JSON for piping/scripting
 *
 * This is the renderer layer: it knows OmniFocus entities and output
 * formats. Terminal primitives (colors, interactivity detection, progress)
 * live one level down in `./ui/` and know nothing about entities.
 */

import type { Plan, PlanNode } from "./ai/plan.js";
import { BridgeError, type CLIError } from "./errors.js";
import { assignShortIds, peekShortId } from "./short-ids.js";
import type {
	CreateTreeResult,
	OFFolder,
	OFProject,
	OFProjectCompact,
	OFTask,
	OutputFormat,
} from "./types.js";
import { bold, cyan, dim, green, red, strike, yellow } from "./ui/colors.js";

// ── Format detection ────────────────────────────────────────────────────────

/** Determine output format from CLI flags or environment. */
export function resolveFormat(jsonFlag?: boolean): OutputFormat {
	if (jsonFlag) return "json";
	// If stdout is not a TTY (piped), default to json
	if (!process.stdout.isTTY) return "json";
	return "human";
}

// ── JSON output ─────────────────────────────────────────────────────────────

export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

// ── Success/Error messages ──────────────────────────────────────────────────

export function outputSuccess(message: string): void {
	console.log(`${green("✓")} ${message}`);
}

/**
 * Report an error on stderr. When stderr is piped (not a TTY), emits one
 * structured JSON line — `{"ok":false,"error":...,"candidates":[...]?}`,
 * mirroring the bridge protocol — so scripts and agents never have to parse
 * decorated human text. On a terminal, renders human-readable text
 * (including "Did you mean:" candidates for BridgeErrors).
 */
export function outputError(error: string | CLIError): void {
	const message = typeof error === "string" ? error : error.message;
	const candidates = error instanceof BridgeError ? error.candidates : undefined;

	if (process.stderr.isTTY !== true) {
		const payload: Record<string, unknown> = { ok: false, error: message };
		if (candidates && candidates.length > 0) payload.candidates = candidates;
		console.error(JSON.stringify(payload));
		return;
	}

	let text = message;
	if (error instanceof BridgeError) {
		// Candidates are live tasks the user may retry by number, so mint
		// short aliases for them just as a listing would.
		const candidateIds = (candidates ?? [])
			.map((c) => (typeof c === "string" ? undefined : c.id))
			.filter((id): id is string => id != null);
		text = error.format(candidateIds.length > 0 ? assignShortIds(candidateIds) : undefined);
	}
	console.error(`${red("✗", process.stderr)} ${text}`);
}

/**
 * Report a warning on stderr. Structured (`{"warning":...}`) when stderr
 * is piped, human-readable on a terminal — same contract as outputError.
 */
export function outputWarning(message: string): void {
	if (process.stderr.isTTY !== true) {
		console.error(JSON.stringify({ warning: message }));
		return;
	}
	console.error(`${yellow("!", process.stderr)} ${message}`);
}

/**
 * Warn (on stderr, so stdout stays parseable) that a list filled its limit
 * and more items may exist.
 */
export function outputLimitNotice(count: number, limit: number): void {
	if (count !== limit) return;
	outputWarning(`showing ${count} items (limit reached) — pass --limit <n> for more`);
}

/** Report the bridge's soft `warnings` (best-effort property application). */
export function outputWarnings(warnings?: string[]): void {
	for (const warning of warnings ?? []) outputWarning(`Partial apply warning: ${warning}`);
}

/**
 * Confirm an action on one entity: "✓ Deleted: Buy milk (42)". The short id
 * is looked up (never minted) so entities leaving circulation don't pollute
 * the alias cache.
 */
export function outputEntityAction(action: string, name: string, id?: string): void {
	const label = action.charAt(0).toUpperCase() + action.slice(1);
	const shortId = id != null ? peekShortId(id) : undefined;
	outputSuccess(`${label}: ${bold(name)}${shortId != null ? ` (${shortId})` : ""}`);
}

// ── Batch results ───────────────────────────────────────────────────────────

export interface BatchItem {
	ok: boolean;
	id?: string;
	name?: string;
	error?: string;
	changes?: string[];
	warnings?: string[];
}

export interface BatchSummary {
	succeeded: number;
	failed: number;
	/** Successful items that carried warnings. */
	partial: number;
}

/** Human rendering shared by every stdin-driven batch verb. */
export function outputBatchSummary(title: string, results: readonly BatchItem[]): BatchSummary {
	const succeeded = results.filter((r) => r.ok);
	const failed = results.filter((r) => !r.ok);
	const partial = succeeded.filter((r) => (r.warnings?.length ?? 0) > 0);

	outputSuccess(`${title}: ${succeeded.length} succeeded, ${failed.length} failed`);
	if (succeeded.length > 0) {
		console.log(green(`\n✓ ${succeeded.length} succeeded:`));
		for (const r of succeeded) {
			const label = r.name ?? r.id ?? "unknown";
			console.log(`  ${label}${r.id ? ` (${r.id})` : ""}`);
			for (const change of r.changes ?? []) console.log(dim(`    • ${change}`));
			for (const warning of r.warnings ?? []) outputWarning(`  ${label}: ${warning}`);
		}
	}
	if (failed.length > 0) {
		console.log(red(`\n✗ ${failed.length} failed:`));
		for (const r of failed) console.log(`  ${r.name ?? r.id ?? "unknown"}: ${r.error}`);
	}
	console.log(dim(`\nTotal: ${results.length} items`));
	return { succeeded: succeeded.length, failed: failed.length, partial: partial.length };
}

// ── Status cues ─────────────────────────────────────────────────────────────

/**
 * What an entity's rendering should signal at a glance. `active` is the
 * default view and stays undecorated — every other cue earns a glyph, so a
 * finished or waiting item is never mistaken for an actionable one.
 */
export type StatusCue = "active" | "completed" | "dropped" | "blocked" | "deferred";

/**
 * Glyphs are text-presentation characters (no emoji-width surprises) and are
 * the load-bearing part of the cue: color merely amplifies them, so the
 * signal survives NO_COLOR and non-color terminals. `finished` marks the
 * terminal states, whose names are additionally dimmed and struck through.
 */
const STATUS_CUES: Record<
	Exclude<StatusCue, "active">,
	{ glyph: string; paint: (s: string) => string; label: string; finished: boolean }
> = {
	completed: { glyph: "✓", paint: green, label: "Completed", finished: true },
	dropped: { glyph: "⊘", paint: red, label: "Dropped", finished: true },
	blocked: { glyph: "‖", paint: yellow, label: "Blocked", finished: false },
	deferred: { glyph: "→", paint: dim, label: "Deferred", finished: false },
};

/**
 * A task's cue. The task's own state wins over the state it inherits from a
 * containing project or parent task, and a terminal state wins over a merely
 * waiting one.
 */
export function taskStatusCue(task: OFTask): StatusCue {
	if (task.completed) return "completed";
	if (task.dropped) return "dropped";
	// A task inside a done/dropped project keeps its own flags false — only
	// the effective ones reveal it, which is why it would otherwise show up
	// in listings looking perfectly actionable.
	if (task.effectivelyCompleted) return "completed";
	if (task.effectivelyDropped) return "dropped";
	if (task.blocked) return "blocked";
	const defer = task.effectiveDeferDate ?? task.deferDate;
	if (defer && new Date(defer) > new Date()) return "deferred";
	return "active";
}

/** A project's cue, derived from the status string the bridge reports. */
export function projectStatusCue(status: string): StatusCue {
	switch (status.toLowerCase().replace(/[-_\s]/g, "")) {
		case "done":
		case "completed":
			return "completed";
		case "dropped":
			return "dropped";
		case "onhold":
		case "hold":
			return "blocked";
		default:
			return "active";
	}
}

/** The painted glyph for a cue, or undefined for the undecorated default. */
function statusGlyph(cue: StatusCue): string | undefined {
	if (cue === "active") return undefined;
	const { glyph, paint } = STATUS_CUES[cue];
	return paint(glyph);
}

/** Dim and strike the name of an entity that is done with — nothing else. */
function styleName(name: string, cue: StatusCue): string {
	if (cue === "active" || !STATUS_CUES[cue].finished) return name;
	return dim(strike(name));
}

// ── Task formatting ─────────────────────────────────────────────────────────

/** Optional short-ID decoration for human-mode task rendering. */
export interface ShortIdDisplay {
	shortId?: number;
	/** Pad width so ids in one listing right-align; defaults to the id's own width. */
	shortIdWidth?: number;
}

export function formatTaskLine(task: OFTask, display: ShortIdDisplay = {}): string {
	const parts: string[] = [];

	// Short numeric alias, right-aligned across the listing
	if (display.shortId != null) {
		const width = display.shortIdWidth ?? String(display.shortId).length;
		parts.push(`${dim(String(display.shortId).padStart(width))} `);
	}

	// Status cue — absent for active tasks, so the default view is unchanged
	const cue = taskStatusCue(task);
	const glyph = statusGlyph(cue);
	if (glyph) parts.push(glyph);

	// Flagged indicator
	if (task.flagged) parts.push("⚑");

	// Name
	parts.push(styleName(task.name, cue));

	// Project (if not Inbox)
	if (task.project && task.project !== "Inbox") {
		parts.push(dim(task.project));
	}

	// Tags
	if (task.tags.length > 0) {
		parts.push(cyan(`[${task.tags.join(", ")}]`));
	}

	// Due date
	if (task.dueDate) {
		const dueStr = formatDateShort(task.dueDate);
		const isOverdue = new Date(task.dueDate) < new Date();
		parts.push(isOverdue ? red(`due:${dueStr}`) : yellow(`due:${dueStr}`));
	}

	// Estimate
	if (task.estimatedMinutes) {
		parts.push(dim(`${task.estimatedMinutes}min`));
	}

	return parts.join(" ");
}

export function formatTaskDetail(task: OFTask, display: ShortIdDisplay = {}): string {
	const lines: string[] = [];

	const cue = taskStatusCue(task);
	lines.push(bold(styleName(task.name, cue)));
	const header = taskStatusHeader(task, cue);
	if (header) lines.push(header);
	if (display.shortId != null) {
		lines.push(`${dim("ID:")} ${display.shortId} ${dim(`(${task.id})`)}`);
	} else {
		lines.push(`${dim("ID:")} ${task.id}`);
	}
	lines.push(`${dim("Project:")} ${task.project}`);

	if (task.note) lines.push(`${dim("Note:")} ${task.note}`);
	if (task.dueDate) lines.push(`${dim("Due:")} ${formatDateLong(task.dueDate)}`);
	if (task.deferDate) lines.push(`${dim("Defer:")} ${formatDateLong(task.deferDate)}`);
	if (task.plannedDate) lines.push(`${dim("Planned:")} ${formatDateLong(task.plannedDate)}`);
	if (task.flagged) lines.push(`${dim("Flagged:")} ${yellow("yes")}`);
	if (task.estimatedMinutes) lines.push(`${dim("Estimate:")} ${task.estimatedMinutes} min`);
	if (task.tags.length > 0) lines.push(`${dim("Tags:")} ${task.tags.join(", ")}`);
	if (Array.isArray(task.notifications)) {
		lines.push(`${dim("Notifications:")} ${task.notifications.length}`);
		for (const notification of task.notifications) {
			const parts: string[] = [];
			parts.push(formatNotificationKind(notification.kind));
			if (notification.absoluteFireDate) {
				parts.push(`at ${formatDateLong(notification.absoluteFireDate)}`);
			}
			if (notification.relativeFireOffsetSeconds != null) {
				parts.push(`offset ${formatDurationSeconds(notification.relativeFireOffsetSeconds)}`);
			}
			if (notification.repeatIntervalSeconds != null) {
				parts.push(`repeat ${formatDurationSeconds(notification.repeatIntervalSeconds)}`);
			}
			lines.push(`  - ${notification.id}: ${parts.join(", ")}`);
		}
	}
	if (task.repetitionRule)
		lines.push(`${dim("Repeat:")} ${task.repetitionRule.rule} (${task.repetitionRule.method})`);
	if (task.sequential) lines.push(`${dim("Sequential:")} yes`);
	if (task.parentTask) lines.push(`${dim("Parent:")} ${task.parentTask.name}`);
	if (task.childCount > 0) lines.push(`${dim("Children:")} ${task.childCount}`);
	if (task.creationDate) lines.push(`${dim("Created:")} ${formatDateLong(task.creationDate)}`);

	return lines.join("\n");
}

/**
 * The status line under a task's name in the detail view: "✓ Completed
 * 2026-03-01", "⊘ Dropped (inherited)". Nothing for an active task.
 */
function taskStatusHeader(task: OFTask, cue: StatusCue): string | undefined {
	if (cue === "active") return undefined;
	const { glyph, paint, label } = STATUS_CUES[cue];
	const parts = [paint(`${glyph} ${label}`)];
	if (cue === "completed" && task.completionDate) parts.push(formatDateShort(task.completionDate));
	if (cue === "deferred") {
		const defer = task.effectiveDeferDate ?? task.deferDate;
		if (defer) parts.push(`until ${formatDateShort(defer)}`);
	}
	// Inherited from a done/dropped container rather than set on the task.
	const inherited =
		cue === "completed" ? !task.completed : cue === "dropped" ? !task.dropped : false;
	if (inherited) parts.push("(inherited)");
	return parts.join(" ");
}

export function outputTaskList(tasks: OFTask[], format: OutputFormat): void {
	if (format === "json") {
		outputJson(tasks);
		return;
	}

	if (tasks.length === 0) {
		console.log(dim("No tasks found."));
		return;
	}

	const aliases = taskShortIds(tasks);
	const width = shortIdColumnWidth(aliases);
	for (const task of tasks) {
		console.log(formatTaskLine(task, { shortId: aliases.get(task.id), shortIdWidth: width }));
	}
	console.log(dim(`\n${tasks.length} task${tasks.length === 1 ? "" : "s"}`));
}

/** Assign short numeric aliases for a set of tasks (human-mode rendering only). */
export function taskShortIds(tasks: readonly Pick<OFTask, "id">[]): Map<string, number> {
	return assignShortIds(tasks.map((t) => t.id));
}

/** Column width that right-aligns every alias in one listing. */
export function shortIdColumnWidth(aliases: ReadonlyMap<string, number>): number {
	let width = 0;
	for (const alias of aliases.values()) {
		width = Math.max(width, String(alias).length);
	}
	return width;
}

export function outputTaskDetail(task: OFTask, format: OutputFormat): void {
	if (format === "json") {
		outputJson(task);
		return;
	}
	const shortId = taskShortIds([task]).get(task.id);
	console.log(formatTaskDetail(task, { shortId }));
}

// ── Project formatting ──────────────────────────────────────────────────────

export function formatProjectLine(project: OFProjectCompact | OFProject): string {
	const parts: string[] = [];
	const cue = projectStatusCue(project.status);
	const glyph = statusGlyph(cue);
	if (glyph) parts.push(glyph);
	parts.push(styleName(project.name, cue));
	parts.push(dim(`[${project.status}]`));
	parts.push(dim(`${project.taskCount} tasks`));
	if ("parentFolder" in project && project.parentFolder) {
		parts.push(dim(`in ${project.parentFolder}`));
	}
	return parts.join(" ");
}

export function formatProjectDetail(project: OFProject): string {
	const lines: string[] = [];

	const cue = projectStatusCue(project.status);
	const glyph = statusGlyph(cue);
	lines.push(`${glyph ? `${glyph} ` : ""}${bold(styleName(project.name, cue))}`);
	lines.push(`${dim("ID:")} ${project.id}`);
	lines.push(`${dim("Status:")} ${project.status}`);
	if (project.note) lines.push(`${dim("Note:")} ${project.note}`);
	if (project.parentFolder) lines.push(`${dim("Folder:")} ${project.parentFolder}`);
	if (project.dueDate) lines.push(`${dim("Due:")} ${formatDateLong(project.dueDate)}`);
	if (project.deferDate) lines.push(`${dim("Defer:")} ${formatDateLong(project.deferDate)}`);
	if (project.flagged) lines.push(`${dim("Flagged:")} ${yellow("yes")}`);
	if (project.sequential) lines.push(`${dim("Sequential:")} yes`);
	if (project.tags.length > 0) lines.push(`${dim("Tags:")} ${project.tags.join(", ")}`);

	const remaining = project.taskCount - project.completedTaskCount;
	const pct =
		project.taskCount > 0 ? Math.round((project.completedTaskCount / project.taskCount) * 100) : 0;
	lines.push(`${dim("Tasks:")} ${remaining} remaining / ${project.taskCount} total (${pct}% done)`);

	if (project.creationDate)
		lines.push(`${dim("Created:")} ${formatDateLong(project.creationDate)}`);

	return lines.join("\n");
}

export function outputProjectList(
	projects: (string | OFProjectCompact | OFProject)[],
	format: OutputFormat,
): void {
	if (format === "json") {
		outputJson(projects);
		return;
	}

	if (projects.length === 0) {
		console.log(dim("No projects found."));
		return;
	}

	for (const p of projects) {
		if (typeof p === "string") {
			console.log(p);
		} else {
			console.log(formatProjectLine(p));
		}
	}
	console.log(dim(`\n${projects.length} project${projects.length === 1 ? "" : "s"}`));
}

// ── Tag formatting ──────────────────────────────────────────────────────────

export function outputTagList(
	tags: (string | { name: string; taskCount?: number })[],
	format: OutputFormat,
): void {
	if (format === "json") {
		outputJson(tags);
		return;
	}

	if (tags.length === 0) {
		console.log(dim("No tags found."));
		return;
	}

	for (const t of tags) {
		if (typeof t === "string") {
			console.log(t);
		} else {
			const count = t.taskCount != null ? dim(` (${t.taskCount} tasks)`) : "";
			console.log(`${t.name}${count}`);
		}
	}
	console.log(dim(`\n${tags.length} tag${tags.length === 1 ? "" : "s"}`));
}

// ── Folder formatting ───────────────────────────────────────────────────────

export function outputFolderList(folders: (string | OFFolder)[], format: OutputFormat): void {
	if (format === "json") {
		outputJson(folders);
		return;
	}

	if (folders.length === 0) {
		console.log(dim("No folders found."));
		return;
	}

	for (const f of folders) {
		if (typeof f === "string") {
			console.log(f);
		} else {
			const parent = f.parentFolder ? dim(` in ${f.parentFolder}`) : "";
			const count = f.projectCount != null ? dim(` (${f.projectCount} projects)`) : "";
			console.log(`${f.name}${parent}${count}`);
		}
	}
	console.log(dim(`\n${folders.length} folder${folders.length === 1 ? "" : "s"}`));
}

// ── Changes list ────────────────────────────────────────────────────────────

export function outputChanges(entity: string, name: string, changes: string[]): void {
	outputSuccess(`Updated ${entity}: ${bold(name)}`);
	for (const change of changes) {
		console.log(`  ${dim("•")} ${change}`);
	}
}

export type DateField = "due" | "defer" | "planned";

/** Display order for a task's dates: how work flows — planned, then defer, then due. */
const DATE_FIELDS: ReadonlyArray<{
	field: DateField;
	label: string;
	prop: "plannedDate" | "deferDate" | "dueDate";
}> = [
	{ field: "planned", label: "Planned", prop: "plannedDate" },
	{ field: "defer", label: "Defer", prop: "deferDate" },
	{ field: "due", label: "Due", prop: "dueDate" },
];

/**
 * Confirmation for a reschedule: the task's name (with its short id when one
 * exists) followed by every date the task now carries, read back from
 * OmniFocus — so what is printed is what the app holds. Fields touched by
 * the command are highlighted (● green); the rest are listed dimmed for
 * context. A touched field that was cleared is still listed, as "cleared";
 * an untouched, unset field is omitted.
 */
export function outputMoved(task: OFTask, touched: readonly DateField[]): void {
	const shortId = peekShortId(task.id);
	outputSuccess(`Moved: ${bold(task.name)}${shortId != null ? ` (${shortId})` : ""}`);
	for (const { field, label, prop } of DATE_FIELDS) {
		const value = task[prop];
		const isTouched = touched.includes(field);
		if (!value && !isTouched) continue;
		const text = `${label}: ${value ? formatDateLong(value) : "cleared"}`;
		console.log(isTouched ? `  ${green("●")} ${green(text)}` : `  ${dim("•")} ${dim(text)}`);
	}
}

// ── AI plan rendering ───────────────────────────────────────────────────────

function orderLabel(sequential: boolean): string {
	return sequential ? "in order" : "any order";
}

function typeWord(sequential: boolean): string {
	return sequential ? "sequential" : "parallel";
}

/** One line per plan node, indented by depth: `<key>  <name> <meta…>` plus a dim note line. */
export function formatPlanTree(tree: PlanNode[], depth = 0, out: string[] = []): string[] {
	const indent = "  ".repeat(depth);
	for (const node of tree) {
		const parts: string[] = [`${indent}${dim(node.key)}`];
		if (node.flag) parts.push("⚑");
		parts.push(node.name);
		if (node.children.length > 0) parts.push(dim(`(${orderLabel(node.sequential)})`));
		if (node.estimateMinutes) parts.push(dim(`${node.estimateMinutes}min`));
		if (node.tags.length > 0) parts.push(cyan(`[${node.tags.join(", ")}]`));
		if (node.due) parts.push(yellow(`due:${node.due}`));
		if (node.defer) parts.push(dim(`defer:${node.defer}`));
		out.push(parts.join(" "));
		if (node.note) out.push(`${indent}${" ".repeat(node.key.length)}  ${dim(node.note)}`);
		formatPlanTree(node.children, depth + 1, out);
	}
	return out;
}

export interface PlanTarget {
	name: string;
	/** The target's current type, to point out when the plan would change it. */
	sequential: boolean;
	/** Direct subtasks that already exist and would be governed by the new type. */
	existingChildren: number;
}

/** Human preview of a breakdown plan before anything is applied. */
export function outputPlanTree(target: PlanTarget, plan: Plan, tree: PlanNode[]): void {
	console.log(
		`${bold(`Plan for: ${target.name}`)} ${dim(`— subtasks ${orderLabel(plan.sequential)}`)}`,
	);
	if (plan.sequential !== target.sequential) {
		const n = target.existingChildren;
		const affected = n > 0 ? `; ${n} existing subtask${n === 1 ? "" : "s"} affected` : "";
		console.log(
			yellow(
				`! Changes the task from ${typeWord(target.sequential)} to ${typeWord(plan.sequential)}${affected}`,
			),
		);
	}
	if (plan.summary) console.log(dim(plan.summary));
	console.log("");
	for (const line of formatPlanTree(tree)) console.log(line);
	const estimate = plan.tasks.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);
	const count = plan.tasks.length;
	console.log(
		dim(
			`\n${count} task${count === 1 ? "" : "s"}${estimate > 0 ? `, ~${estimate} min total` : ""}`,
		),
	);
	if (plan.questions.length > 0) {
		console.log(yellow("\nOpen questions:"));
		for (const q of plan.questions) console.log(`  ${yellow("•")} ${q}`);
	}
}

export interface TreeResultSummary {
	created: number;
	failed: number;
}

/** Human report after `task.createTree`: per-item ✓/✗ lines, warnings on stderr. */
export function outputTreeResult(result: CreateTreeResult): TreeResultSummary {
	const created = result.created.filter((c) => c.ok).length;
	const failed = result.created.length - created;
	const total = result.created.length;
	const head = `Created ${created} of ${total} subtask${total === 1 ? "" : "s"} under ${bold(result.parent.name)}`;
	console.log(failed === 0 ? `${green("✓")} ${head}` : `${yellow("!")} ${head}`);
	for (const item of result.created) {
		if (item.ok) console.log(`  ${green("✓")} ${dim(item.key)}  ${item.name}`);
		else
			console.log(
				`  ${red("✗")} ${dim(item.key)}  ${item.name}${item.error ? `: ${item.error}` : ""}`,
			);
		for (const warning of item.warnings ?? []) outputWarning(`${item.name}: ${warning}`);
	}
	for (const warning of result.warnings) outputWarning(`${result.parent.name}: ${warning}`);
	return { created, failed };
}

// ── Date helpers ────────────────────────────────────────────────────────────

function formatDateShort(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLong(iso: string): string {
	const d = new Date(iso);
	// undefined = the user's own locale
	return d.toLocaleDateString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatNotificationKind(kind: "absolute" | "due-relative" | "unknown"): string {
	if (kind === "absolute") return "absolute";
	if (kind === "due-relative") return "due-relative";
	return "unknown";
}

function formatDurationSeconds(totalSeconds: number): string {
	const sign = totalSeconds < 0 ? "-" : totalSeconds > 0 ? "+" : "";
	let remaining = Math.abs(totalSeconds);
	const hours = Math.floor(remaining / 3600);
	remaining -= hours * 3600;
	const minutes = Math.floor(remaining / 60);
	remaining -= minutes * 60;
	const seconds = remaining;
	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
	return `${sign}${parts.join("")}`;
}
