import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputTaskList, resolveFormat } from "../../core/output.js";
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
		.option("--limit <n>", "Maximum number of tasks", (v: string) => Number.parseInt(v, 10), 20)
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.listTasks({
					filter: opts.filter as TaskFilter,
					limit: opts.limit as number,
				});

				const tasks = unwrapBridgeResponse(response);
				outputTaskList(tasks, format);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
