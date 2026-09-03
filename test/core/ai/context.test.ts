import { describe, expect, test } from "bun:test";
import {
	SIBLING_DISPLAY_LIMIT,
	formatContextDate,
	renderTaskContext,
	todayString,
} from "../../../src/core/ai/context.js";
import type { TaskContext } from "../../../src/core/types.js";
import { MOCK_PROJECT, MOCK_TASK, MOCK_TASK_CONTEXT } from "../../fixtures/mock-responses.js";

const TODAY = "2026-09-03";

describe("renderTaskContext", () => {
	test("renders every section for the mock context", () => {
		const text = renderTaskContext(MOCK_TASK_CONTEXT, { today: TODAY });
		expect(text).toContain("## Today\n2026-09-03");
		expect(text).toContain("## Target task\n- Name: Buy groceries\n- Id: task-abc123");
		expect(text).toContain("- Type: parallel (children in any order)");
		expect(text).toContain("- Note: Milk, eggs, bread");
		expect(text).toContain(`- Due: ${formatContextDate(MOCK_TASK.dueDate)}`);
		expect(text).toContain("- Flagged: yes");
		expect(text).toContain("- Estimate: 30 min");
		expect(text).toContain("- Tags: errand, home");
		expect(text).toContain("- Existing subtasks: 1 direct (1 completed)");
		expect(text).toContain("## Parent tasks (nearest first)\nnone");
		expect(text).toContain("## Project\n- Name: Home Renovation\n- Status: active");
		expect(text).toContain("- Type: sequential (children in order)");
		expect(text).toContain("- Tasks: 10 remaining of 15");
		expect(text).toContain("- Folder: Personal");
		expect(text).toContain("## Existing subtasks");
		expect(text).toContain("- [x] Write shopping list (5 min)");
		expect(text).toContain("## Sibling tasks");
		expect(text).toContain("- [ ] Return library books");
		expect(text).toContain(
			"## Available tags (the only tags that may be used)\nerrand, home, @computer",
		);
		expect(text).not.toContain("Additional context");
	});

	test("includes the user's extra context and nested subtrees", () => {
		const ctx: TaskContext = {
			...MOCK_TASK_CONTEXT,
			ancestors: [{ ...MOCK_TASK, id: "anc", name: "Weekly errands", sequential: true, note: "" }],
			children: [
				{
					...MOCK_TASK,
					id: "c1",
					name: "Step one",
					completed: false,
					note: "A hint",
					sequential: true,
					estimatedMinutes: null,
					tags: ["home"],
					children: [{ ...MOCK_TASK, id: "c1a", name: "Nested", completed: false, children: [] }],
				},
			],
		};
		const text = renderTaskContext(ctx, { today: TODAY, extra: "  Focus on the kitchen  " });
		expect(text).toContain("- [ ] Weekly errands — sequential (children in order)");
		expect(text).toContain("- [ ] Step one (home; in order)\n  note: A hint\n  - [ ] Nested");
		expect(text).toEndWith("## Additional context from the user\nFocus on the kitchen");
	});

	test("caps the sibling list and marks inbox tasks", () => {
		const siblings = Array.from({ length: SIBLING_DISPLAY_LIMIT + 3 }, (_, i) => ({
			id: `s${i}`,
			name: `Sibling ${i}`,
			completed: i % 2 === 0,
		}));
		const ctx: TaskContext = {
			task: {
				...MOCK_TASK,
				inInbox: true,
				note: "",
				tags: [],
				flagged: false,
				estimatedMinutes: null,
			},
			ancestors: [],
			project: null,
			children: [],
			siblings,
			tags: [],
		};
		const text = renderTaskContext(ctx, { today: TODAY });
		expect(text).toContain("- Location: inbox (not yet filed into a project)");
		expect(text).toContain("## Project\nnone (inbox task)");
		expect(text).toContain(
			"## Existing subtasks (already under the target — do not recreate)\nnone",
		);
		expect(text).toContain(`- [ ] Sibling ${SIBLING_DISPLAY_LIMIT - 1}`);
		expect(text).not.toContain(`Sibling ${SIBLING_DISPLAY_LIMIT}\n`);
		expect(text).toContain("- … and 3 more");
		expect(text).toContain("## Available tags (the only tags that may be used)\nnone");
	});

	test("long notes are collapsed to one truncated line", () => {
		const ctx: TaskContext = {
			...MOCK_TASK_CONTEXT,
			task: { ...MOCK_TASK, note: `line one\n\nline two ${"x".repeat(2000)}` },
			project: { ...MOCK_PROJECT, note: "p".repeat(500) },
		};
		const text = renderTaskContext(ctx, { today: TODAY });
		const noteLine = text
			.split("\n")
			.find((l) => l.startsWith("- Note: line one line two")) as string;
		expect(noteLine.length).toBeLessThanOrEqual("- Note: ".length + 1500);
		expect(noteLine.endsWith("…")).toBe(true);
	});
});

describe("date helpers", () => {
	test("formatContextDate renders local wall-clock time and passes junk through", () => {
		expect(formatContextDate(null)).toBeNull();
		expect(formatContextDate("not a date")).toBe("not a date");
		expect(formatContextDate("2026-03-05T00:00:00.000Z")).toMatch(
			/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
		);
	});

	test("todayString is a local calendar date", () => {
		expect(todayString(new Date(2026, 8, 3, 23, 59))).toBe("2026-09-03");
	});
});
