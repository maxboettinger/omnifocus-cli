/**
 * Tests for the assembled Commander program (src/program.ts).
 *
 * Uses a mock client — no OmniFocus required.
 */

import { describe, expect, test } from "bun:test";
import pkg from "../../package.json" with { type: "json" };
import { buildProgram } from "../../src/program.js";
import { createMockClient } from "../fixtures/mock-client.js";

describe("program assembly", () => {
	test("--version reports the package.json version", () => {
		const program = buildProgram(createMockClient());
		expect(program.version()).toBe(pkg.version);
	});
});
