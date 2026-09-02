import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputLimitNotice, outputTaskList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { limitOption } from "../options/common.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("list")
		.description("List inbox items")
		.option("--newest-first", "Sort by creation date, newest first, before applying --limit");
	limitOption(cmd, 50);
	cmd.action(
		runAction(async (ctx) => {
			const limit = ctx.opts.limit as number;
			const data = unwrapBridgeResponse(
				await client.listInbox(limit, { newestFirst: ctx.opts.newestFirst as boolean | undefined }),
			);
			outputTaskList(data, ctx.format);
			outputLimitNotice(data.length, limit);
		}),
	);
}
