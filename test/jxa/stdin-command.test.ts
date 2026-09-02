/**
 * The bridge accepts "@stdin" as its argument, meaning: read the actual
 * command JSON from stdin. This keeps huge payloads (bulk ops, long notes)
 * out of argv, which has a hard size limit (ARG_MAX).
 */

import { describe, expect, test } from "bun:test";
import { makeElementArray, runBridgeArgs } from "./bridge-harness.js";

function emptyDoc(): Record<string, unknown> {
	return {
		inboxTasks: makeElementArray([]),
		flattenedTasks: makeElementArray([]),
		flattenedProjects: makeElementArray([]),
		flattenedTags: makeElementArray([]),
		flattenedFolders: makeElementArray([]),
	};
}

// task.create with no name returns a deterministic, doc-independent error —
// proof the command JSON was decoded and dispatched to the right op.
const PROBE_COMMAND = JSON.stringify({ op: "task.create", params: {} });

describe("@stdin command passing", () => {
	test("reads the command JSON from stdin when args[0] is @stdin", () => {
		const response = runBridgeArgs(emptyDoc(), ["@stdin"], PROBE_COMMAND);
		expect(response.ok).toBeFalse();
		expect(response.error).toBe("Task name required");
	});

	test("fails cleanly when stdin is not valid JSON", () => {
		const response = runBridgeArgs(emptyDoc(), ["@stdin"], "not json");
		expect(response.ok).toBeFalse();
		expect(response.error).toMatch(/Invalid command JSON/);
	});

	test("fails cleanly when stdin cannot be decoded", () => {
		const response = runBridgeArgs(emptyDoc(), ["@stdin"], null);
		expect(response.ok).toBeFalse();
		expect(response.error).toMatch(/stdin/i);
	});

	test("plain argv commands still work unchanged", () => {
		const response = runBridgeArgs(emptyDoc(), [PROBE_COMMAND]);
		expect(response.ok).toBeFalse();
		expect(response.error).toBe("Task name required");
	});
});

describe("OmniFocus unavailable", () => {
	test("returns a structured failure when the app cannot be opened", () => {
		const command = JSON.stringify({ op: "task.create", params: { name: "x" } });
		const response = runBridgeArgs(emptyDoc(), [command], undefined, {
			applicationUnavailable: true,
		});
		expect(response.ok).toBeFalse();
		expect(response.error).toMatch(/OmniFocus could not be opened/);
	});
});
