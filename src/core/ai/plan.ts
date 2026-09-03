/**
 * The breakdown plan: the structured shape the model must return when
 * splitting a task into nano tasks, its JSON schema (sent as a strict
 * `json_schema` response format), the runtime validator, and the tree
 * builder that turns the flat list into nested nodes.
 *
 * The list is flat on purpose. Items point at their parent through
 * `parentKey`, which keeps the schema free of recursive `$ref`s (not
 * portable across OpenRouter providers in strict mode) and makes the
 * apply order trivial: parents are required to appear before children.
 */

import type { StructuredSchema, ValidationFailure } from "./types.js";

export interface PlanTask {
	key: string;
	/** Key of an earlier task in the list, or null for a child of the target. */
	parentKey: string | null;
	name: string;
	note: string;
	estimateMinutes: number | null;
	tags: string[];
	flag: boolean;
	/** Whether this task's own children must be done in order. */
	sequential: boolean;
	due: string | null;
	defer: string | null;
}

export interface Plan {
	summary: string;
	/** The target's own type after applying: its direct children (new and existing) in order or not. */
	sequential: boolean;
	tasks: PlanTask[];
	questions: string[];
}

export interface PlanNode extends PlanTask {
	children: PlanNode[];
}

export const MAX_TASK_NAME_LENGTH = 200;
export const MAX_PLAN_TASKS = 200;

const nullable = (type: string) => ({ type: [type, "null"] });

const TASK_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: [
		"key",
		"parentKey",
		"name",
		"note",
		"estimateMinutes",
		"tags",
		"flag",
		"sequential",
		"due",
		"defer",
	],
	properties: {
		key: { type: "string", description: "Short unique id for this task, e.g. '1', '2.1'." },
		parentKey: {
			...nullable("string"),
			description: "Key of an earlier task this one nests under, or null for a direct child.",
		},
		name: { type: "string", description: "One concrete, observable action." },
		note: { type: "string", description: "Details, options or hints; empty string if none." },
		estimateMinutes: { ...nullable("integer"), description: "Estimated minutes, >= 1." },
		tags: { type: "array", items: { type: "string" }, description: "Only tags from the list." },
		flag: { type: "boolean" },
		sequential: { type: "boolean", description: "Children must be done in order." },
		due: { ...nullable("string"), description: "Due date text OmniFocus understands, or null." },
		defer: { ...nullable("string"), description: "Defer date text, or null." },
	},
};

export const PLAN_SCHEMA: Record<string, unknown> = {
	type: "object",
	additionalProperties: false,
	required: ["summary", "sequential", "tasks", "questions"],
	properties: {
		summary: { type: "string", description: "One sentence on the approach." },
		sequential: {
			type: "boolean",
			description:
				"The target task's own type: true if its direct children (new and existing) must be done in order.",
		},
		tasks: { type: "array", items: TASK_SCHEMA },
		questions: { type: "array", items: { type: "string" } },
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function validateTask(raw: unknown, index: number, seen: Set<string>, errors: string[]): void {
	const where = `tasks[${index}]`;
	if (!isRecord(raw)) {
		errors.push(`${where} must be an object`);
		return;
	}
	const key = typeof raw.key === "string" ? raw.key.trim() : "";
	if (!key) errors.push(`${where}.key must be a non-empty string`);
	else if (seen.has(key)) errors.push(`${where}.key "${key}" is used more than once`);
	const label = key ? `task "${key}"` : where;

	if (raw.parentKey !== null && typeof raw.parentKey !== "string") {
		errors.push(`${label}: parentKey must be a string or null`);
	} else if (typeof raw.parentKey === "string") {
		if (raw.parentKey === key) errors.push(`${label}: parentKey must not point at itself`);
		else if (!seen.has(raw.parentKey)) {
			errors.push(`${label}: parentKey "${raw.parentKey}" must name a task listed earlier`);
		}
	}
	const name = typeof raw.name === "string" ? raw.name.trim() : "";
	if (!name) errors.push(`${label}: name must be a non-empty string`);
	else if (name.length > MAX_TASK_NAME_LENGTH) {
		errors.push(`${label}: name must be at most ${MAX_TASK_NAME_LENGTH} characters`);
	}
	if (typeof raw.note !== "string") errors.push(`${label}: note must be a string`);
	if (
		raw.estimateMinutes !== null &&
		(typeof raw.estimateMinutes !== "number" ||
			!Number.isInteger(raw.estimateMinutes) ||
			raw.estimateMinutes < 1)
	) {
		errors.push(`${label}: estimateMinutes must be an integer >= 1 or null`);
	}
	if (!isStringArray(raw.tags)) errors.push(`${label}: tags must be an array of strings`);
	if (typeof raw.flag !== "boolean") errors.push(`${label}: flag must be a boolean`);
	if (typeof raw.sequential !== "boolean") errors.push(`${label}: sequential must be a boolean`);
	for (const field of ["due", "defer"] as const) {
		if (raw[field] !== null && typeof raw[field] !== "string") {
			errors.push(`${label}: ${field} must be a string or null`);
		}
	}
	if (key) seen.add(key);
}

/** Validate a model response against the plan contract; errors name the offending task. */
export function validatePlan(raw: unknown): { value: Plan } | ValidationFailure {
	const errors: string[] = [];
	if (!isRecord(raw)) return { errors: ["response must be a JSON object"] };
	if (typeof raw.summary !== "string") errors.push("summary must be a string");
	if (typeof raw.sequential !== "boolean") errors.push("sequential must be a boolean");
	if (!isStringArray(raw.questions)) errors.push("questions must be an array of strings");
	if (!Array.isArray(raw.tasks)) errors.push("tasks must be an array");
	else if (raw.tasks.length === 0) errors.push("tasks must not be empty");
	else if (raw.tasks.length > MAX_PLAN_TASKS) {
		errors.push(`tasks must contain at most ${MAX_PLAN_TASKS} items`);
	} else {
		const seen = new Set<string>();
		raw.tasks.forEach((task, index) => validateTask(task, index, seen, errors));
	}
	if (errors.length > 0) return { errors };

	const tasks = (raw.tasks as Record<string, unknown>[]).map(
		(t): PlanTask => ({
			key: (t.key as string).trim(),
			parentKey: t.parentKey as string | null,
			name: (t.name as string).trim(),
			note: (t.note as string).trim(),
			estimateMinutes: t.estimateMinutes as number | null,
			tags: (t.tags as string[]).map((tag) => tag.trim()).filter((tag) => tag.length > 0),
			flag: t.flag as boolean,
			sequential: t.sequential as boolean,
			due: emptyToNull(t.due as string | null),
			defer: emptyToNull(t.defer as string | null),
		}),
	);
	return {
		value: {
			summary: (raw.summary as string).trim(),
			sequential: raw.sequential as boolean,
			tasks,
			questions: (raw.questions as string[]).map((q) => q.trim()).filter((q) => q.length > 0),
		},
	};
}

function emptyToNull(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/** Nest a validated plan's flat task list into a tree, preserving list order. */
export function buildPlanTree(plan: Plan): PlanNode[] {
	const byKey = new Map<string, PlanNode>();
	const roots: PlanNode[] = [];
	for (const task of plan.tasks) {
		const node: PlanNode = { ...task, children: [] };
		byKey.set(task.key, node);
		const parent = task.parentKey === null ? undefined : byKey.get(task.parentKey);
		if (parent) parent.children.push(node);
		else roots.push(node);
	}
	return roots;
}

export function countPlanTasks(plan: Plan): number {
	return plan.tasks.length;
}

/** Sum of estimates over tasks that carry one, in minutes. */
export function planEstimateMinutes(plan: Plan): number {
	return plan.tasks.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);
}

/** The schema + validator bundle handed to `AIClient.structured()`. */
export const PLAN_STRUCTURED: StructuredSchema<Plan> = {
	name: "task_breakdown_plan",
	schema: PLAN_SCHEMA,
	validate: validatePlan,
};
