import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import { bold, outputError } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerRenameCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("rename")
		.description("Rename a project")
		.argument("<query>", "Project name or search query")
		.argument("<new-name>", "New project name")
		.option("--id <id>", "Project ID")
		.option("--json", "JSON output")
		.action(async (query: string, newName: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const renameOptions = {
					id: opts.id as string,
				};

				const response = await client.renameProject(query, newName, renameOptions);
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`Renamed project: ${bold(data.oldName)} → ${bold(data.newName)}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
