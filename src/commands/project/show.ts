import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { formatProjectDetail, outputJson, resolveFormat } from "../../core/output.js";
import { outputError } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerShowCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("show")
		.description("Show project detail")
		.argument("<query>", "Project name or search query")
		.option("--id <id>", "Project ID")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const getOptions = {
					id: opts.id as string,
				};

				const response = await client.getProject(query, getOptions);
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				console.log(formatProjectDetail(data));
			} catch (error) {
				outputError(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});
}
