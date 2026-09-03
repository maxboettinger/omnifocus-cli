import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { CLIError } from "../../core/errors.js";
import { outputLimitNotice, outputTaskList } from "../../core/output.js";
import { resolveTaskId } from "../../core/short-ids.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { limitOption } from "../options/common.js";

export function registerSearchCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("search")
		.description("Search tasks by keyword, or look one up by id")
		.argument("[query]", "Search query, omit with --id")
		.option("--id <id>", "Task ID or short id; returns exactly that task");
	limitOption(cmd, 50);
	cmd.action(
		runAction(async (ctx, query: string | undefined) => {
			const id = ctx.opts.id as string | undefined;
			if (id) {
				if (query) throw new CLIError("--id cannot be combined with a search query");
				// task.get's byId tier matches regardless of completion state, so an
				// id names its task exactly — no keyword scan, no --limit, and a
				// completed task stays findable even though search hides those.
				const task = unwrapBridgeResponse(await client.getTask(resolveTaskId(id)));
				outputTaskList([task], ctx.format);
				return;
			}
			if (!query) throw new CLIError("Provide a search query or --id");
			const limit = ctx.opts.limit as number;
			const tasks = unwrapBridgeResponse(await client.searchTasks(query, limit));
			outputTaskList(tasks, ctx.format);
			outputLimitNotice(tasks.length, limit);
		}),
	);
}
