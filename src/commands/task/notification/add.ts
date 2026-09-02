import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../../core/client.js";
import { BridgeError } from "../../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../../core/output.js";
import { parseDurationToSeconds } from "../../../core/parsers.js";
import { resolveTaskRef } from "../../../core/short-ids.js";
import type { OmniFocusClient } from "../../../core/types.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Add a notification to a task")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
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
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const kind = opts.kind as string;
				const at = opts.at as string;
				const offsetSeconds = opts.offset as number | undefined;
				const repeatSeconds = opts.repeat as number | undefined;

				if (kind !== "absolute" && kind !== "due-relative") {
					outputError("--kind must be one of: absolute, due-relative");
					process.exit(1);
					return;
				}

				if (kind === "absolute" && !at) {
					outputError("--at is required when --kind absolute is used");
					process.exit(1);
					return;
				}
				if (kind === "absolute" && offsetSeconds != null) {
					outputError("--offset cannot be used with --kind absolute");
					process.exit(1);
					return;
				}
				if (kind === "due-relative" && offsetSeconds == null) {
					outputError("--offset is required when --kind due-relative is used");
					process.exit(1);
					return;
				}
				if (kind === "due-relative" && at) {
					outputError("--at cannot be used with --kind due-relative");
					process.exit(1);
					return;
				}
				if (repeatSeconds != null && repeatSeconds < 0) {
					outputError("--repeat must be a non-negative duration");
					process.exit(1);
					return;
				}

				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.addTaskNotification({
					query,
					id: resolveTaskRef(query, opts.id as string | undefined).id,
					kind,
					at,
					offsetSeconds,
					repeatSeconds,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Added notification ${data.notification.id} to: ${data.taskName}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
