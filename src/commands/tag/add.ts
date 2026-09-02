import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create a tag")
		.argument("<tag>", "Tag name")
		.action(
			runAction(async (ctx, tag: string) => {
				const data = unwrapBridgeResponse(await client.createTag(tag));
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Created tag: ${data.name}`);
			}),
		);
}
