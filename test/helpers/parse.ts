/**
 * Parse argv through a throwaway Commander command and capture what the
 * action received. Used by option-group tests so each group is exercised
 * through Commander's real parser rather than by inspecting internals.
 */

import { Command } from "commander";

export interface ParsedInvocation {
	args: unknown[];
	opts: Record<string, unknown>;
}

export function parseCommand(setup: (cmd: Command) => void, argv: string[]): ParsedInvocation {
	let captured: ParsedInvocation = { args: [], opts: {} };
	const cmd = new Command().exitOverride().configureOutput({ writeErr: () => {} });
	setup(cmd);
	cmd.action((...actionArgs: unknown[]) => {
		actionArgs.pop(); // the Command itself
		const opts = actionArgs.pop() as Record<string, unknown>;
		captured = { args: actionArgs, opts };
	});
	cmd.parse(argv, { from: "user" });
	return captured;
}
