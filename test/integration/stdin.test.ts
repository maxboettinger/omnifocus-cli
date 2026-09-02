/**
 * Stdin-reading commands must fail fast with a usage hint when stdin is an
 * interactive terminal, instead of hanging forever waiting for EOF.
 */

import { describe, expect, test } from "bun:test";
import type { Command } from "commander";
import { registerBulkCommands } from "../../src/commands/bulk/index.js";
import { registerInboxCommands } from "../../src/commands/inbox/index.js";
import type { OmniFocusClient } from "../../src/core/types.js";
import { withStdin } from "../helpers/env.js";
import { runCommand } from "../helpers/run.js";

function runWithTtyStdin(
	setup: (program: Command, client: OmniFocusClient) => void,
	argv: string[],
) {
	return withStdin({ isTTY: true }, () => runCommand(setup, argv));
}

describe("stdin TTY guard", () => {
	// Bulk verbs still call readStdin() directly outside runAction, so the
	// CLIError propagates as a rejection.
	const throwingCases: Array<{
		name: string;
		setup: (program: Command, client: OmniFocusClient) => void;
		argv: string[];
	}> = [
		{ name: "bulk create", setup: registerBulkCommands, argv: ["bulk", "create"] },
		{ name: "bulk update", setup: registerBulkCommands, argv: ["bulk", "update"] },
		{ name: "bulk complete", setup: registerBulkCommands, argv: ["bulk", "complete"] },
	];

	for (const { name, setup, argv } of throwingCases) {
		test(`${name} errors immediately when stdin is a TTY`, async () => {
			await expect(runWithTtyStdin(setup, argv)).rejects.toThrow(/No input on stdin.*\| of /s);
		});
	}

	// inbox process-many runs through runAction, which catches the CLIError
	// thrown by readJsonArray/readStdin and reports it via outputError +
	// process.exit instead of letting it propagate as a rejection.
	test("inbox process-many errors immediately when stdin is a TTY", async () => {
		const { stderr, exitCode } = await runWithTtyStdin(registerInboxCommands, [
			"inbox",
			"process-many",
		]);
		expect(exitCode).toBe(1);
		expect(stderr.some((line) => /No input on stdin.*\| of /s.test(line))).toBeTrue();
	});
});
