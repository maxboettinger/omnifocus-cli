import type { Command } from "commander";
import { unwrapBridgeResponse } from "../core/client.js";
import { outputJson, shortIdColumnWidth } from "../core/output.js";
import { parseIntOption } from "../core/parsers.js";
import { assignShortIds } from "../core/short-ids.js";
import type { CollectedTask, OmniFocusClient } from "../core/types.js";
import { dim } from "../core/ui/colors.js";
import { runAction } from "./action.js";

export function registerCollectCommand(program: Command, client: OmniFocusClient): void {
	program
		.command("collect")
		.description("Collect recently completed tasks")
		.option("--days <n>", "Number of days to look back (default: 7)", parseIntOption)
		.action(
			runAction(async (ctx) => {
				const { opts, format } = ctx;
				const response = await client.collectCompleted(opts.days as number | undefined);
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputCollectedTasks(data);
			}),
		);
}

function outputCollectedTasks(tasks: CollectedTask[]): void {
	if (tasks.length === 0) {
		console.log(dim("No completed tasks found."));
		return;
	}

	const aliases = assignShortIds(tasks.map((t) => t.omnifocus_id));
	const width = shortIdColumnWidth(aliases);
	for (const task of tasks) {
		const shortId = aliases.get(task.omnifocus_id);
		const parts: string[] = [];
		if (shortId != null) parts.push(`${dim(String(shortId).padStart(width))} `);
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
