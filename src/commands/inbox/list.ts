import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputTaskList, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("list")
		.description("List inbox items")
		.option(
			"--limit <n>",
			"Limit number of results (default: 500)",
			(v: string) => Number.parseInt(v, 10),
			500,
		)
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const limit = (opts.limit as number) || 500;
				const response = await client.listInbox(limit);
				const data = unwrapBridgeResponse(response);

				outputTaskList(data, format);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Error listing inbox: ${message}`);
				process.exit(1);
			}
		});
}
