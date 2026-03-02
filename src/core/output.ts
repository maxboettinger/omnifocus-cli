/**
 * Output formatting for OmniFocus CLI.
 *
 * Handles two modes:
 * - human: colored, tabular, designed for TTY
 * - json: raw JSON for piping/scripting
 */

import type { OFFolder, OFProject, OFProjectCompact, OFTask, OutputFormat } from "./types.js";

// ── ANSI helpers ────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";

function bold(s: string): string {
	return `${BOLD}${s}${RESET}`;
}
function dim(s: string): string {
	return `${DIM}${s}${RESET}`;
}
function red(s: string): string {
	return `${RED}${s}${RESET}`;
}
function green(s: string): string {
	return `${GREEN}${s}${RESET}`;
}
function yellow(s: string): string {
	return `${YELLOW}${s}${RESET}`;
}
function blue(s: string): string {
	return `${BLUE}${s}${RESET}`;
}
function cyan(s: string): string {
	return `${CYAN}${s}${RESET}`;
}

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

export function outputError(message: string): void {
	console.error(`${red("✗")} ${message}`);
}

export function outputWarning(message: string): void {
	console.error(`${yellow("!")} ${message}`);
}

// ── Task formatting ─────────────────────────────────────────────────────────

export function formatTaskLine(task: OFTask): string {
	const parts: string[] = [];

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

export function formatTaskDetail(task: OFTask): string {
	const lines: string[] = [];

	lines.push(bold(task.name));
	lines.push(`${dim("ID:")} ${task.id}`);
	lines.push(`${dim("Project:")} ${task.project}`);

	if (task.note) lines.push(`${dim("Note:")} ${task.note}`);
	if (task.dueDate) lines.push(`${dim("Due:")} ${formatDateLong(task.dueDate)}`);
	if (task.deferDate) lines.push(`${dim("Defer:")} ${formatDateLong(task.deferDate)}`);
	if (task.plannedDate) lines.push(`${dim("Planned:")} ${formatDateLong(task.plannedDate)}`);
	if (task.flagged) lines.push(`${dim("Flagged:")} ${yellow("yes")}`);
	if (task.estimatedMinutes) lines.push(`${dim("Estimate:")} ${task.estimatedMinutes} min`);
	if (task.tags.length > 0) lines.push(`${dim("Tags:")} ${task.tags.join(", ")}`);
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

	for (const task of tasks) {
		console.log(formatTaskLine(task));
	}
	console.log(dim(`\n${tasks.length} task${tasks.length === 1 ? "" : "s"}`));
}

export function outputTaskDetail(task: OFTask, format: OutputFormat): void {
	if (format === "json") {
		outputJson(task);
		return;
	}
	console.log(formatTaskDetail(task));
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
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Re-export color helpers for use in specialized formatters (e.g., forecast)
export { bold, dim, red, green, yellow, blue, cyan };
