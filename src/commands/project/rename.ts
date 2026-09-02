import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { bold } from "../../core/ui/colors.js";
import { runAction } from "../action.js";
import { projectRefArgument } from "../options/refs.js";

export function registerRenameCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("rename").description("Rename a project");
	projectRefArgument(cmd);
	cmd.argument("<new-name>", "New project name");
	cmd.action(
		runAction(async (ctx, project: string, newName: string) => {
			const data = unwrapBridgeResponse(
				await client.renameProject(project, newName, { id: ctx.opts.id as string | undefined }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Renamed project: ${bold(data.oldName)} → ${bold(data.newName)}`);
		}),
	);
}
