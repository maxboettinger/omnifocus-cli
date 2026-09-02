import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { formatProjectDetail, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { projectRefArgument } from "../options/refs.js";

export function registerShowCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("show").description("Show project detail");
	projectRefArgument(cmd);
	cmd.action(
		runAction(async (ctx, project: string) => {
			const data = unwrapBridgeResponse(
				await client.getProject(project, { id: ctx.opts.id as string | undefined }),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			console.log(formatProjectDetail(data));
		}),
	);
}
