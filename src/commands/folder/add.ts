import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create a folder")
		.argument("<folder>", "Folder name")
		.option("--parent <folder>", "Parent folder name")
		.action(
			runAction(async (ctx, folder: string) => {
				const data = unwrapBridgeResponse(
					await client.createFolder(folder, { parent: ctx.opts.parent as string | undefined }),
				);
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				const parentInfo = data.parentFolder ? ` in ${data.parentFolder}` : "";
				outputSuccess(`Created folder: ${data.name}${parentInfo}`);
			}),
		);
}
