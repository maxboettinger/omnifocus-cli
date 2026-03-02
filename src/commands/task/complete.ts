import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerCompleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("complete")
		.description("Complete a task")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--incomplete", "Mark as incomplete instead")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.completeTask(query, {
					id: opts.id as string,
					incomplete: opts.incomplete as boolean,
				});

				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				const action = data.action === "completed" ? "Completed" : "Marked incomplete";
				outputSuccess(`${action}: ${data.name}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
