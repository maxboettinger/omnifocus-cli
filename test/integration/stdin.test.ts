/**
 * Stdin-reading commands must fail fast with a usage hint when stdin is an
 * interactive terminal, instead of hanging forever waiting for EOF.
 */

import { describe, expect, test } from "bun:test";
import { registerBulkCommands } from "../../src/commands/bulk/index.js";
import { registerInboxCommands } from "../../src/commands/inbox/index.js";
import { withStdin } from "../helpers/env.js";
import { type Setup, runCommand } from "../helpers/run.js";

function runWithTtyStdin(setup: Setup, argv: string[]) {
	return withStdin({ isTTY: true }, () => runCommand(setup, argv));
}

describe("stdin TTY guard", () => {
	// All stdin-driven verbs (bulk add/update/complete, inbox process-many)
	// run through runAction, which catches the CLIError thrown by
	// readJsonArray/readStdin and reports it via outputError + process.exit
	// instead of letting it propagate as a rejection.
	const cases: Array<{
		name: string;
		setup: Setup;
		argv: string[];
	}> = [
		{ name: "bulk add", setup: registerBulkCommands, argv: ["bulk", "add"] },
		{ name: "bulk update", setup: registerBulkCommands, argv: ["bulk", "update"] },
		{ name: "bulk complete", setup: registerBulkCommands, argv: ["bulk", "complete"] },
		{ name: "inbox process-many", setup: registerInboxCommands, argv: ["inbox", "process-many"] },
	];

	for (const { name, setup, argv } of cases) {
		test(`${name} errors immediately when stdin is a TTY`, async () => {
			const { stderr, exitCode } = await runWithTtyStdin(setup, argv);
			expect(exitCode).toBe(1);
			expect(stderr.some((line) => /No input on stdin.*\| of /s.test(line))).toBeTrue();
		});
	}
});
