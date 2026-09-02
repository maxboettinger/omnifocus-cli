import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { CLIError } from "../../../core/errors.js";
import { outputJson, outputSuccess } from "../../../core/output.js";
import { parseDurationOrClear, parseDurationToSeconds } from "../../../core/parsers.js";
import type { OmniFocusClient } from "../../../core/types.js";
import { runAction } from "../../action.js";
import { readTaskRef, taskRefArgument } from "../../options/refs.js";

export function registerUpdateCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("update").description("Update a task notification");
	taskRefArgument(cmd);
	cmd
		.option("--notification-id <id>", "Notification ID")
		.option("--at <date>", "Absolute fire date")
		.option("--offset <duration>", "Relative offset duration", parseDurationToSeconds)
		.option("--repeat <duration|clear>", "Repeat duration or 'clear'", parseDurationOrClear)
		.action(
			runAction(async (ctx, ref: string | undefined) => {
				const notificationId = ctx.opts.notificationId as string;
				const at = ctx.opts.at as string | undefined;
				const offsetSeconds = ctx.opts.offset as number | undefined;
				const repeatSeconds = ctx.opts.repeat as number | "clear" | undefined;

				if (!notificationId) {
					throw new CLIError("--notification-id is required");
				}
				if (at == null && offsetSeconds == null && repeatSeconds == null) {
					throw new CLIError("At least one update is required: --at, --offset, or --repeat");
				}
				if (typeof repeatSeconds === "number" && repeatSeconds < 0) {
					throw new CLIError("--repeat must be a non-negative duration or 'clear'");
				}

				const data = unwrapBridgeResponse(
					await client.updateTaskNotification({
						query: ref,
						id: readTaskRef(ref, ctx.opts).id,
						notificationId,
						at,
						offsetSeconds,
						repeatSeconds,
					}),
				);

				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Updated notification ${data.notification.id} on: ${data.taskName}`);
			}),
		);
}
