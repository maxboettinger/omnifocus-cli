/**
 * Transport tests for executeBridge, using a stub binary (OF_BRIDGE_BIN)
 * in place of /usr/bin/osascript.
 *
 * Small commands travel as an argv argument; large commands must be piped
 * through stdin (argv has a hard size limit, ARG_MAX) with the "@stdin"
 * sentinel argument.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync } from "node:fs";
import { join } from "node:path";
import { executeBridge } from "../../src/core/bridge.js";

const STUB = join(import.meta.dir, "../fixtures/bridge-stub.ts");

interface StubReport {
	lastArg: string;
	stdinLength: number;
}

beforeAll(() => {
	chmodSync(STUB, 0o755);
	process.env.OF_BRIDGE_BIN = STUB;
});

afterAll(() => {
	Reflect.deleteProperty(process.env, "OF_BRIDGE_BIN");
});

describe("executeBridge transport", () => {
	test("small commands are passed as an argv argument", async () => {
		const command = { op: "probe", params: { v: 1 } };
		const response = await executeBridge<StubReport>(command);
		expect(response.ok).toBeTrue();
		if (!response.ok) throw new Error("unreachable");
		expect(response.data.lastArg).toBe(JSON.stringify(command));
		expect(response.data.stdinLength).toBe(0);
	});

	test("large commands are piped through stdin with the @stdin sentinel", async () => {
		const command = { op: "probe", params: { note: "x".repeat(300_000) } };
		const commandJson = JSON.stringify(command);
		const response = await executeBridge<StubReport>(command);
		expect(response.ok).toBeTrue();
		if (!response.ok) throw new Error("unreachable");
		expect(response.data.lastArg).toBe("@stdin");
		expect(response.data.stdinLength).toBe(commandJson.length);
	});
});

describe("executeBridge first-run failures", () => {
	test("throws a clear macOS-only error on non-darwin platforms", async () => {
		const originalPlatform = process.platform;
		const originalBin = process.env.OF_BRIDGE_BIN;
		Reflect.deleteProperty(process.env, "OF_BRIDGE_BIN");
		Object.defineProperty(process, "platform", { value: "linux", configurable: true });
		try {
			await expect(executeBridge({ op: "probe", params: {} })).rejects.toThrow(/macOS/);
		} finally {
			Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
			if (originalBin !== undefined) process.env.OF_BRIDGE_BIN = originalBin;
		}
	});

	test("maps -1743 stderr failures to Automation permission guidance", async () => {
		process.env.OF_STUB_STDERR =
			"execution error: Error: Not authorized to send Apple events to OmniFocus. (-1743)";
		process.env.OF_STUB_EXIT = "1";
		try {
			await expect(executeBridge({ op: "probe", params: {} })).rejects.toThrow(
				/System Settings.*Automation/s,
			);
		} finally {
			Reflect.deleteProperty(process.env, "OF_STUB_STDERR");
			Reflect.deleteProperty(process.env, "OF_STUB_EXIT");
		}
	});
});
