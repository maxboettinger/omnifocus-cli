import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { BridgeError } from "../../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../../core/output.js";
import type { OmniFocusClient } from "../../../core/types.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("delete")
		.description("Delete a task notification")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--notification-id <id>", "Notification ID")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const notificationId = opts.notificationId as string;
				if (!notificationId) {
					outputError("--notification-id is required");
					process.exit(1);
					return;
				}
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.deleteTaskNotification({
					query,
					id: opts.id as string,
					notificationId,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Deleted notification ${data.deletedId} from: ${data.taskName}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
