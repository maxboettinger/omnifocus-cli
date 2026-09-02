import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputTagList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { listQueryOptions, readListQuery } from "../options/common.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("list").description("List tags");
	listQueryOptions(cmd, {
		count: "Include task counts",
		activeOnly: "Show only tags with active tasks",
	});
	cmd.action(
		runAction(async (ctx) => {
			const data = unwrapBridgeResponse(await client.listTags(readListQuery(ctx.opts)));
			outputTagList(data, ctx.format);
		}),
	);
}
