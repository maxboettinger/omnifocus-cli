import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputTaskDetail, resolveFormat } from "../../core/output.js";
import { resolveTaskRef } from "../../core/short-ids.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerShowCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("show")
		.description("Show task detail")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				// Prefer an explicit --id, then a short-id alias, then the raw query.
				// task.get resolves IDs via its byId tier, so an id works as a query.
				const ref = resolveTaskRef(query, opts.id as string | undefined);
				const searchQuery = ref.id ?? query;

				const response = await client.getTask(searchQuery, { includeNotifications: true });

				const task = unwrapBridgeResponse(response);
				outputTaskDetail(task, format);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
