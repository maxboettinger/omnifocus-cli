import type { Command } from "commander";
import { unwrapBridgeResponse } from "../core/client.js";
import { BridgeError } from "../core/errors.js";
import { dim, outputError, outputJson, resolveFormat } from "../core/output.js";
import { parseIntOption } from "../core/parsers.js";
import type { CollectedTask, OmniFocusClient } from "../core/types.js";

export function registerCollectCommand(program: Command, client: OmniFocusClient): void {
	program
		.command("collect")
		.description("Collect recently completed tasks")
		.option("--days <n>", "Number of days to look back (default: 7)", parseIntOption)
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.collectCompleted(opts.days as number | undefined);
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputCollectedTasks(data);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}

function outputCollectedTasks(tasks: CollectedTask[]): void {
	if (tasks.length === 0) {
		console.log(dim("No completed tasks found."));
		return;
	}

	for (const task of tasks) {
		const parts: string[] = [];
		if (task.spoon_emoji) parts.push(task.spoon_emoji);
		parts.push(task.name);
		if (task.project) parts.push(dim(`[${task.project}]`));
		if (task.tags.length > 0) parts.push(dim(task.tags.join(", ")));
		if (task.completion_date) {
			const d = new Date(task.completion_date);
			parts.push(
				dim(
					`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
				),
			);
		}
		console.log(parts.join(" "));
	}
	console.log(dim(`\n${tasks.length} completed task${tasks.length === 1 ? "" : "s"}`));
}
