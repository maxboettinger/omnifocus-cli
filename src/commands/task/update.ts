import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputChanges, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";
import { readTaskEdits, taskEditOptions } from "../options/task-fields.js";

export function registerUpdateCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("update").description("Update a task");
	taskRefArgument(cmd);
	taskEditOptions(cmd)
		.option("--complete", "Mark the task complete")
		.option("--incomplete", "Mark the task incomplete");
	cmd.action(
		runAction(async (ctx, ref: string | undefined) => {
			const data = unwrapBridgeResponse(
				await client.updateTask({
					...readTaskRef(ref, ctx.opts),
					...readTaskEdits(ctx.opts),
					complete: ctx.opts.complete as boolean | undefined,
					incomplete: ctx.opts.incomplete as boolean | undefined,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			outputChanges("task", data.task?.name ?? data.id, data.changes);
		}),
	);
}
