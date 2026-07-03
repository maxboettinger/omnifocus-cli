import { describe, expect, test } from "bun:test";
import {
	BridgeError,
	CLIError,
	ConfirmationRequiredError,
	JXAExecutionError,
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

	test("format() renders structured candidates with project and id", () => {
		const err = new BridgeError("Ambiguous", [
			{ name: "Buy groceries", project: "Errands", id: "task-123" },
		]);
		const formatted = err.format();
		expect(formatted).toContain("Buy groceries");
		expect(formatted).toContain("[Errands]");
		expect(formatted).toContain("(task-123)");
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

describe("ConfirmationRequiredError", () => {
	test("describes action needing confirmation", () => {
		const err = new ConfirmationRequiredError("Delete project");
		expect(err.message).toContain("Delete project");
		expect(err.message).toContain("--confirm");
	});
});
