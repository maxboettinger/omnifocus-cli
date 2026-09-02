import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputEntityAction, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";
import { projectRefArgument } from "../options/refs.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("delete").description("Delete a project");
	projectRefArgument(cmd);
	confirmOption(cmd);
	cmd.action(
		runAction(async (ctx, project: string) => {
			requireConfirm(ctx.opts, "project delete");
			const data = unwrapBridgeResponse(
				await client.deleteProject(project, {
					id: ctx.opts.id as string | undefined,
					confirm: true,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputEntityAction(data.action, data.name);
		}),
	);
}
