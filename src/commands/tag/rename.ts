import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerRenameCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("rename")
		.description("Rename a tag")
		.argument("<old-name>", "Current tag name")
		.argument("<new-name>", "New tag name")
		.option("--json", "JSON output")
		.action(
			async (oldName: string, newName: string, opts: Record<string, unknown>, cmd: Command) => {
				try {
					const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
					const response = await client.renameTag(oldName, newName);
					const data = unwrapBridgeResponse(response);

					if (format === "json") {
						outputJson(data);
						return;
					}

					outputSuccess(`Renamed tag from "${data.oldName}" to "${data.newName}"`);
				} catch (error) {
					if (error instanceof BridgeError) {
						outputError(error.format());
						process.exit(1);
					}
					throw error;
				}
			},
		);
}
