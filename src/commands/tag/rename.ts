import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerRenameCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("rename")
		.description("Rename a tag")
		.argument("<tag>", "Current tag name")
		.argument("<new-name>", "New tag name")
		.action(
			runAction(async (ctx, tag: string, newName: string) => {
				const data = unwrapBridgeResponse(await client.renameTag(tag, newName));
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Renamed tag from "${data.oldName}" to "${data.newName}"`);
			}),
		);
}
