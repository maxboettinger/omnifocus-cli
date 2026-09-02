import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError, ConfirmationRequiredError } from "../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import { peekShortId, resolveTaskRef } from "../../core/short-ids.js";
import type { OmniFocusClient } from "../../core/types.js";
import { bold } from "../../core/ui/colors.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("delete")
		.description("Delete a task (permanent)")
		.argument("[query]", "Task name or search query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--confirm", "Confirm deletion (required for safety)")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				if (!opts.confirm) {
					outputError(new ConfirmationRequiredError("task delete").message);
					process.exit(1);
					return;
				}

				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const ref = resolveTaskRef(query, opts.id as string | undefined);
				const deleteOptions = {
					id: ref.id,
					confirm: opts.confirm as boolean,
				};

				const response = await client.deleteTask(query, deleteOptions);

				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				const action = data.action.charAt(0).toUpperCase() + data.action.slice(1);
				const shortId = data.id != null ? peekShortId(data.id) : undefined;
				outputSuccess(`${action}: ${bold(data.name)}${shortId != null ? ` (${shortId})` : ""}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
