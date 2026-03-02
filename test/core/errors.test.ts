import { describe, expect, test } from "bun:test";
import {
	AmbiguousMatchError,
	BridgeError,
	CLIError,
	ConfirmationRequiredError,
	JXAExecutionError,
	MissingArgumentError,
	NotFoundError,
} from "../../src/core/errors.js";

describe("CLIError", () => {
	test("carries message and default exit code 1", () => {
		const err = new CLIError("something broke");
		expect(err.message).toBe("something broke");
		expect(err.exitCode).toBe(1);
		expect(err).toBeInstanceOf(Error);
	});

	test("accepts custom exit code", () => {
		const err = new CLIError("bad input", 2);
		expect(err.exitCode).toBe(2);
	});
});

describe("BridgeError", () => {
	test("extends CLIError", () => {
		const err = new BridgeError("not found");
		expect(err).toBeInstanceOf(CLIError);
		expect(err).toBeInstanceOf(Error);
	});

	test("format() includes candidates when present", () => {
		const err = new BridgeError("Ambiguous", ["Project A", "Project B"]);
		const formatted = err.format();
		expect(formatted).toContain("Ambiguous");
		expect(formatted).toContain("Did you mean:");
		expect(formatted).toContain("Project A");
		expect(formatted).toContain("Project B");
	});

	test("format() without candidates returns just the message", () => {
		const err = new BridgeError("Task not found");
		expect(err.format()).toBe("Task not found");
	});
});

describe("JXAExecutionError", () => {
	test("captures stderr", () => {
		const err = new JXAExecutionError("osascript failed", "syntax error on line 5");
		expect(err.stderr).toBe("syntax error on line 5");
		expect(err).toBeInstanceOf(CLIError);
	});
});

describe("AmbiguousMatchError", () => {
	test("builds message from entity, query, and candidates", () => {
		const err = new AmbiguousMatchError("task", "groceries", ["Buy groceries", "Get groceries"]);
		expect(err.message).toContain("task");
		expect(err.message).toContain("groceries");
		expect(err.candidates).toEqual(["Buy groceries", "Get groceries"]);
	});
});

describe("NotFoundError", () => {
	test("builds message from entity and query", () => {
		const err = new NotFoundError("project", "Home Reno");
		expect(err.message).toContain("project");
		expect(err.message).toContain("Home Reno");
	});
});

describe("MissingArgumentError", () => {
	test("has exit code 2", () => {
		const err = new MissingArgumentError("name");
		expect(err.exitCode).toBe(2);
		expect(err.message).toContain("name");
	});
});

describe("ConfirmationRequiredError", () => {
	test("describes action needing confirmation", () => {
		const err = new ConfirmationRequiredError("Delete project");
		expect(err.message).toContain("Delete project");
		expect(err.message).toContain("--confirm");
	});
});
