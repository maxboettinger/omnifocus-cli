import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputBatchSummary, outputJson } from "../../core/output.js";
import { readJsonArray } from "../../core/stdin.js";
import type { BulkCreateInput, OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerBulkAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create tasks from stdin JSON")
		.action(
			runAction(async (ctx) => {
				const tasks = await readJsonArray<BulkCreateInput>(
					`echo '[{"name":"Task 1"}]' | of bulk add`,
					"task objects",
					(task, i) =>
						task && typeof task === "object" && task.name
							? undefined
							: `Task at index ${i} is missing required field 'name'`,
				);
				const results = unwrapBridgeResponse(await client.bulkCreate(tasks));
				if (ctx.format === "json") {
					outputJson(results);
					return;
				}
				const summary = outputBatchSummary("Bulk create completed", results);
				if (summary.failed > 0 || summary.partial > 0) process.exit(1);
			}),
		);
}
