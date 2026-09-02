import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { CLIError } from "../../../core/errors.js";
import { outputJson, outputSuccess } from "../../../core/output.js";
import { parseDurationToSeconds } from "../../../core/parsers.js";
import type { OmniFocusClient } from "../../../core/types.js";
import { runAction } from "../../action.js";
import { readTaskRef, taskRefArgument } from "../../options/refs.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("add").description("Add a notification to a task");
	taskRefArgument(cmd);
	cmd
		.option("--kind <kind>", "Notification kind (absolute|due-relative)")
		.option("--at <date>", "Absolute fire date (required for absolute)")
		.option(
			"--offset <duration>",
			"Relative offset (required for due-relative, e.g. -1h30m)",
			parseDurationToSeconds,
		)
		.option(
			"--repeat <duration>",
			"Repeat interval duration (e.g. 1h, 30m, 1h30m)",
			parseDurationToSeconds,
		)
		.action(
			runAction(async (ctx, ref: string | undefined) => {
				const kind = ctx.opts.kind as string;
				const at = ctx.opts.at as string | undefined;
				const offsetSeconds = ctx.opts.offset as number | undefined;
				const repeatSeconds = ctx.opts.repeat as number | undefined;
				if (kind !== "absolute" && kind !== "due-relative") {
					throw new CLIError("--kind must be one of: absolute, due-relative");
				}
				if (kind === "absolute" && !at) {
					throw new CLIError("--at is required when --kind absolute is used");
				}
				if (kind === "absolute" && offsetSeconds != null) {
					throw new CLIError("--offset cannot be used with --kind absolute");
				}
				if (kind === "due-relative" && offsetSeconds == null) {
					throw new CLIError("--offset is required when --kind due-relative is used");
				}
				if (kind === "due-relative" && at) {
					throw new CLIError("--at cannot be used with --kind due-relative");
				}
				if (repeatSeconds != null && repeatSeconds < 0) {
					throw new CLIError("--repeat must be a non-negative duration");
				}
				const data = unwrapBridgeResponse(
					await client.addTaskNotification({
						query: ref,
						id: readTaskRef(ref, ctx.opts).id,
						kind,
						at,
						offsetSeconds,
						repeatSeconds,
					}),
				);
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Added notification ${data.notification.id} to: ${data.taskName}`);
			}),
		);
}
