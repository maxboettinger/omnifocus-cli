import { describe, expect, test } from "bun:test";
import { unwrapBridgeResponse } from "../../src/core/client.js";
import { BridgeError } from "../../src/core/errors.js";
import type { BridgeResponse } from "../../src/core/types.js";

describe("unwrapBridgeResponse", () => {
	test("returns data on success", () => {
		const response: BridgeResponse<{ id: string }> = {
			ok: true,
			data: { id: "abc123" },
		};
		const result = unwrapBridgeResponse(response);
		expect(result).toEqual({ id: "abc123" });
	});

	test("throws BridgeError on failure", () => {
		const response: BridgeResponse = {
			ok: false,
			error: "Task not found",
		};
		expect(() => unwrapBridgeResponse(response)).toThrow(BridgeError);
	});

	test("BridgeError includes candidates from response", () => {
		const response: BridgeResponse = {
			ok: false,
			error: "Ambiguous",
			candidates: ["Project A", "Project B"],
		};
		try {
			unwrapBridgeResponse(response);
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(BridgeError);
			expect((e as BridgeError).candidates).toEqual(["Project A", "Project B"]);
		}
	});

	test("BridgeError keeps structured candidates from response", () => {
		const response: BridgeResponse = {
			ok: false,
			error: "Ambiguous",
			candidates: [{ id: "task-1", name: "Buy groceries", project: "Errands" }],
		};
		try {
			unwrapBridgeResponse(response);
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(BridgeError);
			expect((e as BridgeError).candidates).toEqual([
				{ id: "task-1", name: "Buy groceries", project: "Errands" },
			]);
		}
	});
});

describe("unwrapBridgeResponse known-failure mapping", () => {
	test("rewrites Apple Events permission denials into actionable guidance", () => {
		const response: BridgeResponse = {
			ok: false,
			error: "Operation 'task.list' failed: Not authorized to send Apple events to OmniFocus.",
		};
		try {
			unwrapBridgeResponse(response);
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(BridgeError);
			expect((e as BridgeError).message).toContain("System Settings");
		}
	});

	test("leaves ordinary bridge errors untouched", () => {
		const response: BridgeResponse = { ok: false, error: 'Task not found: "foo"' };
		expect(() => unwrapBridgeResponse(response)).toThrow('Task not found: "foo"');
	});
});
