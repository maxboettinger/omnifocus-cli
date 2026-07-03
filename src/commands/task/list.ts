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
import type { OmniFocusClient, TaskFilter } from "../../core/types.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("list")
		.description("List tasks")
		.option(
			"--filter <filter>",
			"Filter type (inbox|available|flagged|due-soon|overdue|all)",
			"available",
		)
		.option("--limit <n>", "Maximum number of tasks", parseIntOption, 20)
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.listTasks({
					filter: opts.filter as TaskFilter,
					limit: opts.limit as number,
					includeNotifications: format === "json",
				});

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
