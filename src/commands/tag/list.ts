import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputTagList, resolveFormat } from "../../core/output.js";
import { parseIntOption } from "../../core/parsers.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("list")
		.description("List tags")
		.option("--search <query>", "Search for tags by name")
		.option("--count", "Include task counts")
		.option("--active-only", "Show only tags with active tasks")
		.option("--limit <n>", "Limit number of results", parseIntOption)
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.listTags({
					search: opts.search as string,
					count: opts.count as boolean,
					activeOnly: opts.activeOnly as boolean,
					limit: opts.limit as number,
				});
				const data = unwrapBridgeResponse(response);

				outputTagList(data, format);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
