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
	const cases: Array<{
		name: string;
		setup: (program: Command, client: OmniFocusClient) => void;
		argv: string[];
	}> = [
		{ name: "bulk create", setup: registerBulkCommands, argv: ["bulk", "create"] },
		{ name: "bulk update", setup: registerBulkCommands, argv: ["bulk", "update"] },
		{ name: "bulk complete", setup: registerBulkCommands, argv: ["bulk", "complete"] },
		{
			name: "inbox process-many",
			setup: registerInboxCommands,
			argv: ["inbox", "process-many"],
		},
	];

	for (const { name, setup, argv } of cases) {
		test(`${name} errors immediately when stdin is a TTY`, async () => {
			await expect(runWithTtyStdin(setup, argv)).rejects.toThrow(/No input on stdin.*\| of /s);
		});
	}
});
