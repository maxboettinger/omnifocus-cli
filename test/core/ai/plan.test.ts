import { describe, expect, test } from "bun:test";
import {
	MAX_TASK_NAME_LENGTH,
	PLAN_SCHEMA,
	PLAN_STRUCTURED,
	type Plan,
	buildPlanTree,
	countPlanTasks,
	planEstimateMinutes,
	validatePlan,
} from "../../../src/core/ai/plan.js";
import { isValidationFailure } from "../../../src/core/ai/types.js";

function task(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		key: "1",
		parentKey: null,
		name: "Open the portal",
		note: "",
		estimateMinutes: 2,
		tags: [],
		flag: false,
		sequential: false,
		due: null,
		defer: null,
		...overrides,
	};
}

function plan(tasks: Record<string, unknown>[], overrides: Record<string, unknown> = {}) {
	return { summary: "Step by step", sequential: true, tasks, questions: [], ...overrides };
}

function errorsOf(raw: unknown): string[] {
	const result = validatePlan(raw);
	if (!isValidationFailure(result)) throw new Error("expected a validation failure");
	return result.errors;
}

describe("validatePlan", () => {
	test("accepts a well-formed plan and normalises whitespace", () => {
		const result = validatePlan(
			plan(
				[
					task({ key: " 1 ", name: "  Open the portal ", note: " x " }),
					task({ key: "2", parentKey: "1", name: "Log in", tags: [" @computer ", ""], due: " " }),
				],
				{ summary: " Step by step ", questions: [" What year? ", ""] },
			),
		);
		expect(isValidationFailure(result)).toBe(false);
		const value = (result as { value: Plan }).value;
		expect(value.summary).toBe("Step by step");
		expect(value.questions).toEqual(["What year?"]);
		expect(value.tasks[0]?.key).toBe("1");
		expect(value.tasks[0]?.name).toBe("Open the portal");
		expect(value.tasks[0]?.note).toBe("x");
		expect(value.tasks[1]).toMatchObject({ parentKey: "1", tags: ["@computer"], due: null });
	});

	test("rejects non-objects and top-level shape problems", () => {
		expect(errorsOf("nope")).toEqual(["response must be a JSON object"]);
		expect(errorsOf({})).toEqual([
			"summary must be a string",
			"sequential must be a boolean",
			"questions must be an array of strings",
			"tasks must be an array",
		]);
		expect(errorsOf(plan([]))).toEqual(["tasks must not be empty"]);
	});

	test("names the offending task for duplicate and unknown keys", () => {
		expect(errorsOf(plan([task(), task()]))).toEqual(['tasks[1].key "1" is used more than once']);
		expect(errorsOf(plan([task({ parentKey: "9" })]))).toEqual([
			'task "1": parentKey "9" must name a task listed earlier',
		]);
		// Forward references are rejected: parents must come first.
		expect(errorsOf(plan([task({ key: "1", parentKey: "2" }), task({ key: "2" })]))).toEqual([
			'task "1": parentKey "2" must name a task listed earlier',
		]);
		expect(errorsOf(plan([task({ parentKey: "1" })]))).toEqual([
			'task "1": parentKey must not point at itself',
		]);
	});

	test("checks every field type", () => {
		expect(errorsOf(plan([task({ name: "  " })]))).toEqual([
			'task "1": name must be a non-empty string',
		]);
		expect(errorsOf(plan([task({ name: "x".repeat(MAX_TASK_NAME_LENGTH + 1) })]))).toEqual([
			`task "1": name must be at most ${MAX_TASK_NAME_LENGTH} characters`,
		]);
		expect(errorsOf(plan([task({ estimateMinutes: 2.5 })]))).toEqual([
			'task "1": estimateMinutes must be an integer >= 1 or null',
		]);
		expect(errorsOf(plan([task({ estimateMinutes: 0 })]))).toHaveLength(1);
		expect(errorsOf(plan([task({ tags: "home" })]))).toEqual([
			'task "1": tags must be an array of strings',
		]);
		expect(errorsOf(plan([task({ flag: "yes", sequential: 1, due: 5, defer: {} })]))).toEqual([
			'task "1": flag must be a boolean',
			'task "1": sequential must be a boolean',
			'task "1": due must be a string or null',
			'task "1": defer must be a string or null',
		]);
		expect(errorsOf(plan([task({ key: "" })]))[0]).toBe("tasks[0].key must be a non-empty string");
		expect(errorsOf(plan(["not a task" as unknown as Record<string, unknown>]))).toEqual(["tasks[0] must be an object"]);
	});
});

describe("buildPlanTree", () => {
	test("nests children under parents in list order", () => {
		const result = validatePlan(
			plan([
				task({ key: "1", name: "A" }),
				task({ key: "1.1", parentKey: "1", name: "A1" }),
				task({ key: "1.1.1", parentKey: "1.1", name: "A1a", estimateMinutes: null }),
				task({ key: "2", name: "B", estimateMinutes: 10 }),
				task({ key: "1.2", parentKey: "1", name: "A2" }),
			]),
		) as { value: Plan };
		const tree = buildPlanTree(result.value);
		expect(tree.map((n) => n.name)).toEqual(["A", "B"]);
		expect(tree[0]?.children.map((n) => n.name)).toEqual(["A1", "A2"]);
		expect(tree[0]?.children[0]?.children.map((n) => n.name)).toEqual(["A1a"]);
		expect(countPlanTasks(result.value)).toBe(5);
		expect(planEstimateMinutes(result.value)).toBe(2 + 2 + 10 + 2);
	});
});

describe("PLAN_STRUCTURED", () => {
	test("bundles the schema with the validator under a stable name", () => {
		expect(PLAN_STRUCTURED.name).toBe("task_breakdown_plan");
		expect(PLAN_STRUCTURED.schema).toBe(PLAN_SCHEMA);
		expect(PLAN_STRUCTURED.validate(plan([task()]))).toHaveProperty("value");
	});

	test("the schema is strict-mode friendly: every property required, no extras", () => {
		const root = PLAN_SCHEMA as { required: string[]; properties: Record<string, unknown> };
		expect(root.required.sort()).toEqual(Object.keys(root.properties).sort());
		const item = (root.properties.tasks as { items: { required: string[]; properties: object } })
			.items;
		expect(item.required.sort()).toEqual(Object.keys(item.properties).sort());
		expect(JSON.stringify(PLAN_SCHEMA)).not.toContain("$ref");
	});
});
