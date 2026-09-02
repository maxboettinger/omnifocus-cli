import { describe, expect, test } from "bun:test";
import {
	readTaskCreate,
	readTaskDates,
	readTaskEdits,
	taskCreateOptions,
	taskDateOptions,
	taskEditOptions,
} from "../../../src/commands/options/task-fields.js";
import { parseCommand } from "../../helpers/parse.js";

describe("taskDateOptions", () => {
	test("declares all three dates by default", () => {
		const { opts } = parseCommand(
			(cmd) => taskDateOptions(cmd),
			["--due", "tomorrow", "--defer", "mon", "--planned", "thu"],
		);
		expect(readTaskDates(opts)).toEqual({ due: "tomorrow", defer: "mon", planned: "thu" });
	});

	test("restricts to the requested fields", () => {
		expect(() =>
			parseCommand((cmd) => taskDateOptions(cmd, { fields: ["defer", "planned"] }), ["--due", "x"]),
		).toThrow();
	});

	test("clearable mode documents 'clear' in the help text", () => {
		const { opts } = parseCommand(
			(cmd) => taskDateOptions(cmd, { clearable: true }),
			["--due", "clear"],
		);
		expect(readTaskDates(opts).due).toBe("clear");
	});
});

describe("taskCreateOptions / readTaskCreate", () => {
	test("maps every create flag onto TaskCreateOptions", () => {
		const { opts } = parseCommand(
			(cmd) => taskCreateOptions(cmd),
			[
				"--note",
				"n",
				"--due",
				"2026-03-05",
				"--tag",
				"a",
				"--tag",
				"b",
				"--flag",
				"--estimate",
				"30",
				"--project",
				"P",
				"--sequential",
				"--repeat",
				"FREQ=DAILY",
				"--repeat-method",
				"fixed",
			],
		);
		expect(readTaskCreate("Buy milk", opts)).toEqual({
			name: "Buy milk",
			note: "n",
			due: "2026-03-05",
			defer: undefined,
			planned: undefined,
			tags: ["a", "b"],
			flag: true,
			estimate: 30,
			project: "P",
			parent: undefined,
			parentId: undefined,
			sequential: true,
			repeat: "FREQ=DAILY",
			repeatMethod: "fixed",
		});
	});

	test("--parent-id wins and --parent passes through as a query", () => {
		const byId = parseCommand((cmd) => taskCreateOptions(cmd), ["--parent-id", "abc"]).opts;
		expect(readTaskCreate("x", byId)).toMatchObject({ parent: undefined, parentId: "abc" });
		const byName = parseCommand((cmd) => taskCreateOptions(cmd), ["--parent", "Groceries"]).opts;
		expect(readTaskCreate("x", byName)).toMatchObject({ parent: "Groceries", parentId: undefined });
	});
});

describe("taskEditOptions / readTaskEdits", () => {
	test("maps every edit flag, including clear values", () => {
		const { opts } = parseCommand(
			(cmd) => taskEditOptions(cmd),
			[
				"--name",
				"New",
				"--note-append",
				"more",
				"--due",
				"clear",
				"--estimate",
				"clear",
				"--tag",
				"t",
				"--remove-tag",
				"u",
				"--unflag",
				"--parallel",
				"--project",
				"P",
				"--repeat",
				"clear",
			],
		);
		expect(readTaskEdits(opts)).toEqual({
			name: "New",
			note: undefined,
			noteAppend: "more",
			due: "clear",
			defer: undefined,
			planned: undefined,
			flag: undefined,
			unflag: true,
			estimate: "clear",
			tags: ["t"],
			removeTags: ["u"],
			project: "P",
			sequential: undefined,
			parallel: true,
			repeat: "clear",
			repeatMethod: undefined,
		});
	});
});
