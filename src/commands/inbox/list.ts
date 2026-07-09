import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import {
	outputError,
	outputLimitNotice,
	outputTaskList,
	resolveFormat,
} from "../../core/output.js";
import { parseIntOption } from "../../core/parsers.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("list")
		.description("List inbox items")
		.option("--limit <n>", "Limit number of results", parseIntOption, 50)
		.option("--newest-first", "Sort by creation date, newest first (before applying --limit)")
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.listInbox(opts.limit as number, {
					newestFirst: opts.newestFirst as boolean,
				});
				const data = unwrapBridgeResponse(response);

				outputTaskList(data, format);
				outputLimitNotice(data.length, opts.limit as number);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
