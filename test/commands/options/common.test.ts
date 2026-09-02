import { describe, expect, test } from "bun:test";
import {
	confirmOption,
	limitOption,
	listQueryOptions,
	readListQuery,
	requireConfirm,
} from "../../../src/commands/options/common.js";
import { ConfirmationRequiredError } from "../../../src/core/errors.js";
import { parseCommand } from "../../helpers/parse.js";

describe("confirmOption / requireConfirm", () => {
	test("throws ConfirmationRequiredError naming the action when --confirm is absent", () => {
		const { opts } = parseCommand((cmd) => confirmOption(cmd), []);
		expect(() => requireConfirm(opts, "task delete")).toThrow(ConfirmationRequiredError);
		expect(() => requireConfirm(opts, "task delete")).toThrow(
			"task delete requires --confirm flag for safety",
		);
	});

	test("passes when --confirm is given", () => {
		const { opts } = parseCommand((cmd) => confirmOption(cmd), ["--confirm"]);
		expect(() => requireConfirm(opts, "task delete")).not.toThrow();
	});
});

describe("limitOption", () => {
	test("parses --limit as an integer and applies the default", () => {
		expect(parseCommand((cmd) => limitOption(cmd, 20), []).opts.limit).toBe(20);
		expect(parseCommand((cmd) => limitOption(cmd, 20), ["--limit", "5"]).opts.limit).toBe(5);
		expect(parseCommand((cmd) => limitOption(cmd), []).opts.limit).toBeUndefined();
	});
});

describe("listQueryOptions", () => {
	test("declares --search, --count, --limit and optionally --active-only", () => {
		const { opts } = parseCommand(
			(cmd) => listQueryOptions(cmd, { count: "Include counts", activeOnly: "Only active" }),
			["--search", "x", "--count", "--active-only", "--limit", "3"],
		);
		expect(readListQuery(opts)).toEqual({ search: "x", count: true, activeOnly: true, limit: 3 });
	});

	test("omits --active-only when no label is given", () => {
		expect(() =>
			parseCommand((cmd) => listQueryOptions(cmd, { count: "c" }), ["--active-only"]),
		).toThrow();
	});
});
