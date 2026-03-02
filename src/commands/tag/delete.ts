import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerDeleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("delete")
		.description("Delete a tag")
		.argument("<name>", "Tag name to delete")
		.option("--confirm", "Confirm deletion (required)")
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				if (!opts.confirm) {
					console.error("Error: --confirm flag is required for tag deletion");
					process.exit(1);
				}

				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.deleteTag(name, { confirm: opts.confirm as boolean });
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`${data.action}: ${data.name}`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Error deleting tag: ${message}`);
				process.exit(1);
			}
		});
}
