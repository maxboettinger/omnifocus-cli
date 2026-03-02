import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputFolderList, resolveFormat } from "../../core/output.js";
import { parseIntOption } from "../../core/parsers.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("list")
		.description("List folders")
		.option("--search <query>", "Search for folders by name")
		.option("--count", "Include project counts")
		.option("--limit <n>", "Limit number of results", parseIntOption)
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.listFolders({
					search: opts.search as string,
					count: opts.count as boolean,
					limit: opts.limit as number,
				});
				const data = unwrapBridgeResponse(response);

				outputFolderList(data, format);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
