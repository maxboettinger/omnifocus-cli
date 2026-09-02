import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { CLIError } from "../../../core/errors.js";
import { outputJson, outputSuccess } from "../../../core/output.js";
import type { OmniFocusClient } from "../../../core/types.js";
import { runAction } from "../../action.js";
import { readTaskRef, taskRefArgument } from "../../options/refs.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("delete").description("Delete a task notification");
	taskRefArgument(cmd);
	cmd.option("--notification-id <id>", "Notification ID").action(
		runAction(async (ctx, ref: string | undefined) => {
			const notificationId = ctx.opts.notificationId as string;
			if (!notificationId) {
				throw new CLIError("--notification-id is required");
			}
			const data = unwrapBridgeResponse(
				await client.deleteTaskNotification({
					query: ref,
					id: readTaskRef(ref, ctx.opts).id,
					notificationId,
				}),
			);

			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Deleted notification ${data.deletedId} from: ${data.taskName}`);
		}),
	);
}
