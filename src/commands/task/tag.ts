import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

export function registerTagCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("tag").description("Apply tags to a task");
	taskRefArgument(cmd, "required");
	cmd.argument("<tags...>", "Tags to apply");
	cmd.action(
		runAction(async (ctx, ref: string, tags: string[]) => {
			const resolved = readTaskRef(ref, ctx.opts);
			const data = unwrapBridgeResponse(await client.applyTag(ref, tags, { id: resolved.id }));
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputSuccess(`Applied tags to: ${data.name}`);
			outputSuccess(`  Applied: ${data.applied.join(", ")}`);
		}),
	);
}
