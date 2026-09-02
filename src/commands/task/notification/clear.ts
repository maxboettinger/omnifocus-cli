import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { BridgeError, ConfirmationRequiredError } from "../../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../../core/output.js";
import { resolveTaskRef } from "../../../core/short-ids.js";
import type { OmniFocusClient } from "../../../core/types.js";

export function registerClearCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("clear")
		.description("Delete all notifications from a task")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--confirm", "Confirm deletion of all notifications")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				if (!opts.confirm) {
					outputError(new ConfirmationRequiredError("task notification clear").message);
					process.exit(1);
					return;
				}
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.clearTaskNotifications({
					query,
					id: resolveTaskRef(query, opts.id as string | undefined).id,
					confirm: opts.confirm as boolean,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Cleared ${data.cleared} notification(s) from: ${data.taskName}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
