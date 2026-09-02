import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputEntityAction, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("delete").description("Delete a tag").argument("<tag>", "Tag name");
	confirmOption(cmd);
	cmd.action(
		runAction(async (ctx, tag: string) => {
			requireConfirm(ctx.opts, "tag delete");
			const data = unwrapBridgeResponse(await client.deleteTag(tag, { confirm: true }));
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputEntityAction(data.action, data.name);
		}),
	);
}
