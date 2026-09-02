import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { BridgeError } from "../../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../../core/output.js";
import { resolveTaskRef } from "../../../core/short-ids.js";
import type { OFTaskNotification, OmniFocusClient } from "../../../core/types.js";
import { dim } from "../../../core/ui/colors.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("list")
		.description("List notifications for a task")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.listTaskNotifications({
					query,
					id: resolveTaskRef(query, opts.id as string | undefined).id,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`Notifications for: ${data.taskName}`);
				if (data.notifications.length === 0) {
					console.log(dim("No notifications found."));
					return;
				}
				for (const notification of data.notifications) {
					console.log(formatNotification(notification));
				}
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}

function formatNotification(notification: OFTaskNotification): string {
	const parts: string[] = [notification.kind];
	if (notification.absoluteFireDate) {
		parts.push(`at ${notification.absoluteFireDate}`);
	}
	if (notification.relativeFireOffsetSeconds != null) {
		parts.push(`offset ${notification.relativeFireOffsetSeconds}s`);
	}
	if (notification.repeatIntervalSeconds != null) {
		parts.push(`repeat ${notification.repeatIntervalSeconds}s`);
	}
	return `- ${notification.id}: ${parts.join(", ")}`;
}
