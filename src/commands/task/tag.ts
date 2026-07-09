import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerTagCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("tag")
		.description("Apply tags to a task")
		.argument("<query>", "Task query")
		.argument("<tags...>", "Tags to apply")
		.option("--id <id>", "Task ID")
		.option("--json", "JSON output")
		.action(async (query: string, tags: string[], opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.applyTag(query, tags, {
					id: opts.id as string,
				});

				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`Applied tags to: ${data.name}`);
				outputSuccess(`  Applied: ${data.applied.join(", ")}`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
