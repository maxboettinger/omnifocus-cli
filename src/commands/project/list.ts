import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputProjectList, resolveFormat } from "../../core/output.js";
import { outputError } from "../../core/output.js";
import { parseIntOption } from "../../core/parsers.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("list")
		.description("List projects")
		.option("--search <query>", "Search query")
		.option("--status <status>", "Filter by status (active|done|onhold|dropped)")
		.option("--folder <name>", "Filter by folder")
		.option("--count", "Include task counts")
		.option("--full", "Verbose output")
		.option("--active-only", "Show only active projects")
		.option("--limit <n>", "Limit number of results", parseIntOption)
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const listOptions = {
					search: opts.search as string,
					status: opts.status as string,
					folder: opts.folder as string,
					count: opts.count as boolean,
					full: opts.full as boolean,
					activeOnly: opts.activeOnly as boolean,
					limit: opts.limit as number,
				};

				const response = await client.listProjects(listOptions);
				const data = unwrapBridgeResponse(response);

				outputProjectList(data, format);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
