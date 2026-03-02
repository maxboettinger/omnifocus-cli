import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create a new folder")
		.argument("<name>", "Folder name")
		.option("--parent <name>", "Parent folder name")
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.createFolder(name, {
					parent: opts.parent as string,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				const parentInfo = data.parentFolder ? ` in ${data.parentFolder}` : "";
				outputSuccess(`Created folder: ${data.name}${parentInfo}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
