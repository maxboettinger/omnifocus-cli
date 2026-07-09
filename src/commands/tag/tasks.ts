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

export function registerTasksCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("tasks")
		.description("List tasks with this tag")
		.argument("<name>", "Tag name")
		.option("--limit <n>", "Limit number of results", parseIntOption, 50)
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.listTasksByTag(name, opts.limit as number);
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
