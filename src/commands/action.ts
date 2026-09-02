/**
 * Shared scaffolding for Commander action handlers.
 *
 * Every verb does the same three things around its real work: resolve the
 * output format from `--json` (local or global), catch `CLIError`s and
 * report them through `outputError` so structured data (disambiguation
 * candidates) survives into JSON-mode stderr, and exit with the error's
 * code. `runAction` centralises that so a verb file only contains what is
 * specific to it.
 *
 * Usage:
 *   .action(runAction(async (ctx, query: string) => { ... }))
 *
 * Commander invokes actions as `(...positionals, opts, cmd)`; the wrapper
 * peels `opts`/`cmd` off the end and hands the positionals through.
 */

import type { Command } from "commander";
import { CLIError } from "../core/errors.js";
import { outputError, resolveFormat } from "../core/output.js";
import type { OutputFormat } from "../core/types.js";

export interface ActionContext {
	/** "json" when --json was passed or stdout is piped, else "human". */
	format: OutputFormat;
	/** Parsed options of the invoked command (local options only). */
	opts: Record<string, unknown>;
	/** The invoked Commander command, for `optsWithGlobals()` etc. */
	cmd: Command;
}

export type ActionHandler<A extends unknown[]> = (
	ctx: ActionContext,
	...positionals: A
) => Promise<void> | void;

export function runAction<A extends unknown[]>(
	handler: ActionHandler<A>,
): (...args: unknown[]) => Promise<void> {
	return async (...args: unknown[]) => {
		const cmd = args.pop() as Command;
		const opts = args.pop() as Record<string, unknown>;
		const format = resolveFormat(
			(opts.json as boolean | undefined) || (cmd.optsWithGlobals().json as boolean | undefined),
		);
		try {
			await handler({ format, opts, cmd }, ...(args as A));
		} catch (error) {
			if (error instanceof CLIError) {
				outputError(error);
				process.exit(error.exitCode);
				return;
			}
			throw error;
		}
	};
}
