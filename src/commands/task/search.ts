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

export function registerSearchCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("search")
		.description("Search tasks by keyword")
		.argument("<query>", "Search query")
		.option("--limit <n>", "Maximum number of results", parseIntOption, 50)
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.searchTasks(query, opts.limit as number);

				const tasks = unwrapBridgeResponse(response);
				outputTaskList(tasks, format);
				outputLimitNotice(tasks.length, opts.limit as number);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
