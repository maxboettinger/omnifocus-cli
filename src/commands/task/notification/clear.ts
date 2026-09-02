import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { outputJson, outputSuccess } from "../../../core/output.js";
import type { OmniFocusClient } from "../../../core/types.js";
import { runAction } from "../../action.js";
import { confirmOption, requireConfirm } from "../../options/common.js";
import { readTaskRef, taskRefArgument } from "../../options/refs.js";

export function registerClearCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("clear").description("Delete all notifications from a task");
	taskRefArgument(cmd);
	confirmOption(cmd, "Confirm deletion of all notifications");
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			requireConfirm(ctx.opts, "task notification clear");
			const data = unwrapBridgeResponse(
				await client.clearTaskNotifications({
					query: ref,
					id: readTaskRef(ref, ctx.opts).id,
					confirm: true,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Cleared ${data.cleared} notification(s) from: ${data.taskName}`);
		}),
	);
}
