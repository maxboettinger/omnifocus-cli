import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputEntityAction, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("delete").description("Delete a task permanently");
	taskRefArgument(cmd);
	confirmOption(cmd);
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			requireConfirm(ctx.opts, "task delete");
			const resolved = readTaskRef(ref, ctx.opts);
			const data = unwrapBridgeResponse(
				await client.deleteTask(ref as string, { id: resolved.id, confirm: true }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputEntityAction(data.action, data.name, data.id);
		}),
	);
}
