/**
 * Render a `TaskContext` (the `task.context` bridge payload) as the
 * Markdown block that opens every AI conversation about a task.
 *
 * The prompt files stay static; everything situational — the task, where
 * it sits, what already exists under it, what the user added — arrives
 * through this one renderer, so both verbs describe OmniFocus to the
 * model in exactly the same words.
 */

import type { ContextNode, OFProject, OFTask, TaskContext } from "../types.js";

export interface RenderContextOptions {
	/** Local calendar date, e.g. "2026-09-03". */
	today: string;
	/** Free-form text the user passed with --context. */
	extra?: string;
}

export const SIBLING_DISPLAY_LIMIT = 40;
const TARGET_NOTE_LIMIT = 1500;
const OTHER_NOTE_LIMIT = 200;

function pad2(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

/** Local wall-clock `YYYY-MM-DD HH:mm` — what the user sees in OmniFocus. */
export function formatContextDate(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function truncate(text: string, limit: number): string {
	const oneLine = text.replace(/\s+/g, " ").trim();
	return oneLine.length > limit ? `${oneLine.slice(0, limit - 1)}…` : oneLine;
}

function checkbox(completed: boolean): string {
	return completed ? "[x]" : "[ ]";
}

function orderWord(sequential: boolean): string {
	return sequential ? "sequential (children in order)" : "parallel (children in any order)";
}

function taskFacts(task: OFTask, noteLimit: number): string[] {
	const facts: string[] = [];
	if (task.note) facts.push(`- Note: ${truncate(task.note, noteLimit)}`);
	const due = formatContextDate(task.dueDate);
	const defer = formatContextDate(task.deferDate);
	const planned = formatContextDate(task.plannedDate);
	if (due) facts.push(`- Due: ${due}`);
	if (defer) facts.push(`- Defer until: ${defer}`);
	if (planned) facts.push(`- Planned for: ${planned}`);
	if (task.flagged) facts.push("- Flagged: yes");
	if (task.estimatedMinutes) facts.push(`- Estimate: ${task.estimatedMinutes} min`);
	if (task.tags.length > 0) facts.push(`- Tags: ${task.tags.join(", ")}`);
	if (task.repetitionRule) facts.push(`- Repeats: ${task.repetitionRule.rule}`);
	return facts;
}

function renderTarget(task: OFTask, children: ContextNode[]): string[] {
	const lines = [
		"## Target task",
		`- Name: ${task.name}`,
		`- Id: ${task.id}`,
		`- Status: ${task.completed ? "completed" : task.blocked ? "blocked (waiting on earlier tasks)" : "open"}`,
		`- Type: ${orderWord(task.sequential)}`,
		...taskFacts(task, TARGET_NOTE_LIMIT),
	];
	if (task.inInbox) lines.push("- Location: inbox (not yet filed into a project)");
	const done = countCompleted(children);
	lines.push(
		`- Existing subtasks: ${children.length === 0 ? "none" : `${children.length} direct (${done} completed)`}`,
	);
	return lines;
}

function countCompleted(nodes: ContextNode[]): number {
	return nodes.filter((n) => n.completed).length;
}

function renderAncestors(ancestors: OFTask[]): string[] {
	const lines = ["## Parent tasks (nearest first)"];
	if (ancestors.length === 0) return [...lines, "none"];
	for (const a of ancestors) {
		lines.push(`- ${checkbox(a.completed)} ${a.name} — ${orderWord(a.sequential)}`);
		for (const fact of taskFacts(a, OTHER_NOTE_LIMIT)) lines.push(`  ${fact}`);
	}
	return lines;
}

function renderProject(project: OFProject | null): string[] {
	const lines = ["## Project"];
	if (!project) return [...lines, "none (inbox task)"];
	const remaining = project.taskCount - project.completedTaskCount;
	lines.push(
		`- Name: ${project.name}`,
		`- Status: ${project.status}`,
		`- Type: ${orderWord(project.sequential)}`,
		`- Tasks: ${remaining} remaining of ${project.taskCount}`,
	);
	if (project.parentFolder) lines.push(`- Folder: ${project.parentFolder}`);
	const due = formatContextDate(project.dueDate);
	if (due) lines.push(`- Due: ${due}`);
	if (project.note) lines.push(`- Note: ${truncate(project.note, OTHER_NOTE_LIMIT)}`);
	return lines;
}

function renderSubtree(nodes: ContextNode[], depth: number, out: string[]): void {
	const indent = "  ".repeat(depth);
	for (const node of nodes) {
		const bits: string[] = [];
		if (node.estimatedMinutes) bits.push(`${node.estimatedMinutes} min`);
		if (node.tags.length > 0) bits.push(node.tags.join(", "));
		if (node.children.length > 0) bits.push(node.sequential ? "in order" : "any order");
		const suffix = bits.length > 0 ? ` (${bits.join("; ")})` : "";
		out.push(`${indent}- ${checkbox(node.completed)} ${node.name}${suffix}`);
		if (node.note) out.push(`${indent}  note: ${truncate(node.note, OTHER_NOTE_LIMIT)}`);
		renderSubtree(node.children, depth + 1, out);
	}
}

function renderChildren(children: ContextNode[]): string[] {
	const lines = ["## Existing subtasks (already under the target — do not recreate)"];
	if (children.length === 0) return [...lines, "none"];
	renderSubtree(children, 0, lines);
	return lines;
}

function renderSiblings(ctx: TaskContext): string[] {
	const lines = ["## Sibling tasks (same container, for orientation only)"];
	if (ctx.siblings.length === 0) return [...lines, "none"];
	const shown = ctx.siblings.slice(0, SIBLING_DISPLAY_LIMIT);
	for (const s of shown) lines.push(`- ${checkbox(s.completed)} ${s.name}`);
	if (ctx.siblings.length > shown.length) {
		lines.push(`- … and ${ctx.siblings.length - shown.length} more`);
	}
	return lines;
}

function renderTags(tags: string[]): string[] {
	const lines = ["## Available tags (the only tags that may be used)"];
	return [...lines, tags.length === 0 ? "none" : tags.join(", ")];
}

/** The full Markdown context block for a task. */
export function renderTaskContext(ctx: TaskContext, opts: RenderContextOptions): string {
	const sections: string[][] = [
		["## Today", opts.today],
		renderTarget(ctx.task, ctx.children),
		renderAncestors(ctx.ancestors),
		renderProject(ctx.project),
		renderChildren(ctx.children),
		renderSiblings(ctx),
		renderTags(ctx.tags),
	];
	if (opts.extra?.trim()) {
		sections.push(["## Additional context from the user", opts.extra.trim()]);
	}
	return sections.map((s) => s.join("\n")).join("\n\n");
}

/** Local calendar date for "today", in the renderer's format. */
export function todayString(now: Date = new Date()): string {
	return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
