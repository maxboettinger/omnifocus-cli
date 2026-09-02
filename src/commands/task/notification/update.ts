import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { BridgeError } from "../../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../../core/output.js";
import { parseDurationOrClear, parseDurationToSeconds } from "../../../core/parsers.js";
import { resolveTaskRef } from "../../../core/short-ids.js";
import type { OmniFocusClient } from "../../../core/types.js";

export function registerUpdateCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("update")
		.description("Update a task notification")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--notification-id <id>", "Notification ID")
		.option("--at <date>", "Absolute fire date")
		.option("--offset <duration>", "Relative offset duration", parseDurationToSeconds)
		.option("--repeat <duration|clear>", "Repeat duration or 'clear'", parseDurationOrClear)
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const notificationId = opts.notificationId as string;
				const at = opts.at as string | undefined;
				const offsetSeconds = opts.offset as number | undefined;
				const repeatSeconds = opts.repeat as number | "clear" | undefined;

				if (!notificationId) {
					outputError("--notification-id is required");
					process.exit(1);
					return;
				}
				if (at == null && offsetSeconds == null && repeatSeconds == null) {
					outputError("At least one update is required: --at, --offset, or --repeat");
					process.exit(1);
					return;
				}
				if (typeof repeatSeconds === "number" && repeatSeconds < 0) {
					outputError("--repeat must be a non-negative duration or 'clear'");
					process.exit(1);
					return;
				}

				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.updateTaskNotification({
					query,
					id: resolveTaskRef(query, opts.id as string | undefined).id,
					notificationId,
					at,
					offsetSeconds,
					repeatSeconds,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Updated notification ${data.notification.id} on: ${data.taskName}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
