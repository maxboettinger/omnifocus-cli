import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import {
	dim,
	green,
	outputError,
	outputJson,
	outputSuccess,
	red,
	resolveFormat,
} from "../../core/output.js";
import type { BulkUpdateInput, OmniFocusClient } from "../../core/types.js";

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

export function registerBulkUpdateCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("update")
		.description("Update tasks from stdin JSON")
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				// Read JSON from stdin
				const input = await readStdin();
				if (!input.trim()) {
					outputError("No input provided. Expected JSON array of update objects on stdin.");
					process.exit(1);
				}

				let updates: BulkUpdateInput[];
				try {
					updates = JSON.parse(input);
				} catch (parseError) {
					outputError(
						`Invalid JSON input: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
					);
					process.exit(1);
				}

				if (!Array.isArray(updates)) {
					outputError("Input must be an array of update objects");
					process.exit(1);
				}

				if (updates.length === 0) {
					outputError("Input array is empty");
					process.exit(1);
				}

				// Validate required fields
				for (let i = 0; i < updates.length; i++) {
					const update = updates[i];
					if (!update || typeof update !== "object" || !update.id) {
						outputError(`Update object at index ${i} is missing required field 'id'`);
						process.exit(1);
					}
				}

				const response = await client.bulkUpdate(updates);
				const results = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(results);
					return;
				}

				// Human-friendly output
				const succeeded = results.filter((r) => r.ok);
				const failed = results.filter((r) => !r.ok);

				outputSuccess(
					`Bulk update completed: ${succeeded.length} succeeded, ${failed.length} failed`,
				);

				if (succeeded.length > 0) {
					console.log(green(`\n✓ Successfully updated ${succeeded.length} tasks:`));
					for (const result of succeeded) {
						console.log(`  ${result.name} (${result.id})`);
						if (result.changes && result.changes.length > 0) {
							for (const change of result.changes) {
								console.log(dim(`    • ${change}`));
							}
						}
					}
				}

				if (failed.length > 0) {
					console.log(red(`\n✗ Failed to update ${failed.length} tasks:`));
					for (const result of failed) {
						console.log(`  ${result.id}: ${result.error}`);
					}
				}

				console.log(dim(`\nTotal: ${results.length} tasks processed`));

				// Exit with error code if any failed
				if (failed.length > 0) {
					process.exit(1);
				}
			} catch (error) {
				outputError(
					`Bulk update failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				process.exit(1);
			}
		});
}
