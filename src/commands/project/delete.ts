import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError, ConfirmationRequiredError } from "../../core/errors.js";
import { bold, outputError, outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("delete")
		.description("Delete a project")
		.argument("<query>", "Project name or search query")
		.option("--id <id>", "Project ID")
		.option("--confirm", "Confirm deletion (required for safety)")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				if (!opts.confirm) {
					outputError(new ConfirmationRequiredError("project delete").message);
					process.exit(1);
					return;
				}

				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const deleteOptions = {
					id: opts.id as string,
					confirm: opts.confirm as boolean,
				};

				const response = await client.deleteProject(query, deleteOptions);
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`${data.action}: ${bold(data.name)}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
