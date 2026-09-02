import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputLimitNotice, outputTaskList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { limitOption } from "../options/common.js";

export function registerTasksCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("tasks")
		.description("List tasks with this tag")
		.argument("<tag>", "Tag name");
	limitOption(cmd, 50);
	cmd.action(
		runAction(async (ctx, tag: string) => {
			const limit = ctx.opts.limit as number;
			const data = unwrapBridgeResponse(await client.listTasksByTag(tag, limit));
			outputTaskList(data, ctx.format);
			outputLimitNotice(data.length, limit);
		}),
	);
}
