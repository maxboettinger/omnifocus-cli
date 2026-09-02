import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputBatchSummary, outputJson } from "../../core/output.js";
import { readJsonArray } from "../../core/stdin.js";
import type { BulkUpdateInput, OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerBulkUpdateCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("update")
		.description("Update tasks from stdin JSON")
		.action(
			runAction(async (ctx) => {
				const updates = await readJsonArray<BulkUpdateInput>(
					`echo '[{"id":"abc","due":"2026-04-01"}]' | of bulk update`,
					"update objects",
					(update, i) =>
						update && typeof update === "object" && update.id
							? undefined
							: `Update object at index ${i} is missing required field 'id'`,
				);
				const results = unwrapBridgeResponse(await client.bulkUpdate(updates));
				if (ctx.format === "json") {
					outputJson(results);
					return;
				}
				if (outputBatchSummary("Bulk update completed", results).failed > 0) process.exit(1);
			}),
		);
}
