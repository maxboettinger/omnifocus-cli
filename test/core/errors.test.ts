import { describe, expect, test } from "bun:test";
import {
	BridgeError,
	CLIError,
	ConfirmationRequiredError,
	JXAExecutionError,
	matchKnownBridgeFailure,
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

describe("matchKnownBridgeFailure", () => {
	test("maps Apple Events authorization denial (-1743) to actionable guidance", () => {
		const raw = "execution error: Error: Not authorized to send Apple events to OmniFocus. (-1743)";
		const mapped = matchKnownBridgeFailure(raw);
		expect(mapped).toContain("System Settings");
		expect(mapped).toContain("Automation");
		expect(mapped).toContain("-1743");
	});

	test("maps wrapped operation failures mentioning -1743", () => {
		const raw = "Operation 'task.list' failed: Not authorized to send Apple events to OmniFocus.";
		expect(matchKnownBridgeFailure(raw)).toContain("Automation");
	});

	test("maps app-not-found to an install hint", () => {
		const raw = "execution error: Error: Application can't be found. (-2700)";
		const mapped = matchKnownBridgeFailure(raw);
		expect(mapped).toContain("OmniFocus");
		expect(mapped).toContain("omnigroup.com");
	});

	test("maps the bridge's own could-not-open failure", () => {
		const raw = "OmniFocus could not be opened: Application can't be found.";
		expect(matchKnownBridgeFailure(raw)).toContain("omnigroup.com");
	});

	test("returns null for unrelated failures", () => {
		expect(matchKnownBridgeFailure('Task not found: "foo"')).toBeNull();
		expect(matchKnownBridgeFailure("syntax error on line 5")).toBeNull();
	});
});
