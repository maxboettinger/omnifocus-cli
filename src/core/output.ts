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

import { BridgeError, type CLIError } from "./errors.js";
import { assignShortIds } from "./short-ids.js";
import type { OFFolder, OFProject, OFProjectCompact, OFTask, OutputFormat } from "./types.js";
import { bold, cyan, dim, green, red, yellow } from "./ui/colors.js";

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

	// Flagged indicator
	if (task.flagged) parts.push("⚑");

	// Name
	parts.push(task.name);

	// Project (if not Inbox)
	if (task.project && task.project !== "Inbox") {
		parts.push(dim(`[${task.project}]`));
	}

	// Tags
	if (task.tags.length > 0) {
		parts.push(cyan(task.tags.join(", ")));
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

	lines.push(bold(task.name));
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
	if (task.blocked) lines.push(`${dim("Blocked:")} ${red("yes")}`);
	if (task.parentTask) lines.push(`${dim("Parent:")} ${task.parentTask.name}`);
	if (task.childCount > 0) lines.push(`${dim("Children:")} ${task.childCount}`);
	if (task.completed) lines.push(`${dim("Completed:")} ${green("yes")}`);
	if (task.creationDate) lines.push(`${dim("Created:")} ${formatDateLong(task.creationDate)}`);

	return lines.join("\n");
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
	parts.push(project.name);
	parts.push(dim(`[${project.status}]`));
	parts.push(dim(`${project.taskCount} tasks`));
	if ("parentFolder" in project && project.parentFolder) {
		parts.push(dim(`in ${project.parentFolder}`));
	}
	return parts.join(" ");
}

export function formatProjectDetail(project: OFProject): string {
	const lines: string[] = [];

	lines.push(bold(project.name));
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
