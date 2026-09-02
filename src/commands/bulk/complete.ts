import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputBatchSummary, outputJson } from "../../core/output.js";
import { readJsonArray } from "../../core/stdin.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerBulkCompleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("complete")
		.description("Complete tasks from stdin JSON")
		.option("--incomplete", "Mark tasks as incomplete instead")
		.action(
			runAction(async (ctx) => {
				const incomplete = ctx.opts.incomplete as boolean | undefined;
				const taskIds = await readJsonArray<string>(
					`echo '["id1","id2"]' | of bulk complete`,
					"task ID strings",
					(id, i) =>
						typeof id === "string" && id.trim()
							? undefined
							: `Task ID at index ${i} must be a non-empty string`,
				);
				const results = unwrapBridgeResponse(await client.bulkComplete(taskIds, { incomplete }));
				if (ctx.format === "json") {
					outputJson(results);
					return;
				}
				const action = incomplete ? "incomplete" : "complete";
				if (outputBatchSummary(`Bulk ${action} completed`, results).failed > 0) process.exit(1);
			}),
		);
}
