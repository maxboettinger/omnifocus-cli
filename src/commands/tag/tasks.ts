import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputTaskList, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerTasksCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("tasks")
		.description("List tasks with this tag")
		.argument("<name>", "Tag name")
		.option("--limit <n>", "Limit number of results", Number.parseInt)
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.listTasksByTag(name, opts.limit as number);
				const data = unwrapBridgeResponse(response);

				outputTaskList(data, format);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Error listing tasks by tag: ${message}`);
				process.exit(1);
			}
		});
}
