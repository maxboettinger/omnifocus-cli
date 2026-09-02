import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputLimitNotice, outputTaskList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { limitOption } from "../options/common.js";

export function registerSearchCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("search")
		.description("Search tasks by keyword")
		.argument("<query>", "Search query");
	limitOption(cmd, 50);
	cmd.action(
		runAction(async (ctx, query: string) => {
			const limit = ctx.opts.limit as number;
			const tasks = unwrapBridgeResponse(await client.searchTasks(query, limit));
			outputTaskList(tasks, ctx.format);
			outputLimitNotice(tasks.length, limit);
		}),
	);
}
