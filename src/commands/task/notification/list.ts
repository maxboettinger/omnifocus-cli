import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { outputJson, outputSuccess } from "../../../core/output.js";
import type { OFTaskNotification, OmniFocusClient } from "../../../core/types.js";
import { dim } from "../../../core/ui/colors.js";
import { runAction } from "../../action.js";
import { readTaskRef, taskRefArgument } from "../../options/refs.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("list").description("List notifications for a task");
	taskRefArgument(cmd);
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			const data = unwrapBridgeResponse(
				await client.listTaskNotifications({ query: ref, id: readTaskRef(ref, ctx.opts).id }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Notifications for: ${data.taskName}`);
			if (data.notifications.length === 0) {
				console.log(dim("No notifications found."));
				return;
			}
			for (const notification of data.notifications) console.log(formatNotification(notification));
		}),
	);
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
