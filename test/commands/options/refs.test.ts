import { describe, expect, test } from "bun:test";
import {
	projectRefArgument,
	readTaskRef,
	taskRefArgument,
} from "../../../src/commands/options/refs.js";
import { parseCommand } from "../../helpers/parse.js";

describe("taskRefArgument", () => {
	test("optional shape accepts no ref and an --id", () => {
		const { args, opts } = parseCommand((cmd) => taskRefArgument(cmd), ["--id", "abc"]);
		expect(args).toEqual([undefined]);
		expect(readTaskRef(args[0] as string | undefined, opts)).toEqual({
			query: undefined,
			id: "abc",
		});
	});

	test("required shape rejects a missing ref", () => {
		expect(() => parseCommand((cmd) => taskRefArgument(cmd, "required"), [])).toThrow();
	});

	test("variadic shape collects every ref", () => {
		const { args } = parseCommand((cmd) => taskRefArgument(cmd, "variadic"), ["1", "Call mom"]);
		expect(args).toEqual([["1", "Call mom"]]);
	});

	test("a non-numeric ref passes through as a query", () => {
		const { args, opts } = parseCommand((cmd) => taskRefArgument(cmd), ["Buy milk"]);
		expect(readTaskRef(args[0] as string, opts)).toEqual({ query: "Buy milk" });
	});
});

describe("projectRefArgument", () => {
	test("required by default, with --id", () => {
		const { args, opts } = parseCommand((cmd) => projectRefArgument(cmd), ["Home", "--id", "p1"]);
		expect(args).toEqual(["Home"]);
		expect(opts.id).toBe("p1");
	});

	test("optional shape allows omitting the project", () => {
		const { args } = parseCommand((cmd) => projectRefArgument(cmd, "optional"), ["--id", "p1"]);
		expect(args).toEqual([undefined]);
	});
});
