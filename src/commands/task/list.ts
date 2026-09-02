import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputLimitNotice, outputTaskList } from "../../core/output.js";
import type { OmniFocusClient, TaskFilter } from "../../core/types.js";
import { runAction } from "../action.js";
import { limitOption } from "../options/common.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("list")
		.description("List tasks")
		.option(
			"--filter <filter>",
			"Filter type, inbox|available|flagged|due-soon|overdue|all",
			"available",
		);
	limitOption(cmd, 20);
	cmd.action(
		runAction(async (ctx) => {
			const limit = ctx.opts.limit as number;
			const tasks = unwrapBridgeResponse(
				await client.listTasks({
					filter: ctx.opts.filter as TaskFilter,
					limit,
					includeNotifications: ctx.format === "json",
				}),
			);
			outputTaskList(tasks, ctx.format);
			outputLimitNotice(tasks.length, limit);
		}),
	);
}
