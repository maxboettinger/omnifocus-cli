import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputTaskDetail } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

export function registerShowCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("show").description("Show task detail");
	taskRefArgument(cmd);
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			// task.get resolves ids through its byId tier, so a resolved id works as the query.
			const resolved = readTaskRef(ref, ctx.opts);
			const task = unwrapBridgeResponse(
				await client.getTask(resolved.id ?? (ref as string), { includeNotifications: true }),
			);
			outputTaskDetail(task, ctx.format);
		}),
	);
}
