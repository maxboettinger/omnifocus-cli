import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess, outputTaskDetail, outputWarnings } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskCreate, taskCreateOptions } from "../options/task-fields.js";

/**
 * `of task add <name>` — one creator for inbox tasks, project tasks and
 * subtasks: `--project` files it, `--parent`/`--parent-id` nests it, neither
 * lands it in the inbox. Also mounted as `of inbox add` (see ../inbox/index.ts).
 */
export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("add")
		.description("Create a task, in the inbox unless --project or --parent is given")
		.argument("<name>", "Task name");
	taskCreateOptions(cmd);
	cmd.action(
		runAction(async (ctx, name: string) => {
			const data = unwrapBridgeResponse(await client.createTask(readTaskCreate(name, ctx.opts)));
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputWarnings(data.warnings);
			outputTaskDetail(data.task, ctx.format);
			if (data.parent) outputSuccess(`Subtask of: ${data.parent.name} [${data.parent.project}]`);
		}),
	);
}
