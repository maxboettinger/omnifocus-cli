import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import {
	dim,
	green,
	outputError,
	outputJson,
	outputSuccess,
	red,
	resolveFormat,
} from "../../core/output.js";
import { readStdin } from "../../core/stdin.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerBulkCompleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("complete")
		.description("Complete tasks from stdin JSON")
		.option("--incomplete", "Mark tasks as incomplete instead")
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
			const incomplete = opts.incomplete as boolean;

			try {
				// Read JSON from stdin
				const input = await readStdin(`echo '["id1","id2"]' | of bulk complete`);
				if (!input.trim()) {
					outputError("No input provided. Expected JSON array of task IDs on stdin.");
					process.exit(1);
				}

				let taskIds: string[];
				try {
					taskIds = JSON.parse(input);
				} catch (parseError) {
					outputError(
						`Invalid JSON input: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
					);
					process.exit(1);
				}

				if (!Array.isArray(taskIds)) {
					outputError("Input must be an array of task ID strings");
					process.exit(1);
				}

				if (taskIds.length === 0) {
					outputError("Input array is empty");
					process.exit(1);
				}

				// Validate that all items are strings
				for (let i = 0; i < taskIds.length; i++) {
					const id = taskIds[i];
					if (typeof id !== "string" || !id.trim()) {
						outputError(`Task ID at index ${i} must be a non-empty string`);
						process.exit(1);
					}
				}

				const response = await client.bulkComplete(taskIds, { incomplete });
				const results = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(results);
					return;
				}

				// Human-friendly output
				const succeeded = results.filter((r) => r.ok);
				const failed = results.filter((r) => !r.ok);
				const action = incomplete ? "incomplete" : "complete";

				outputSuccess(
					`Bulk ${action} completed: ${succeeded.length} succeeded, ${failed.length} failed`,
				);

				if (succeeded.length > 0) {
					console.log(green(`\n✓ Successfully marked ${succeeded.length} tasks as ${action}:`));
					for (const result of succeeded) {
						console.log(`  ${result.name} (${result.id})`);
					}
				}

				if (failed.length > 0) {
					console.log(red(`\n✗ Failed to mark ${failed.length} tasks as ${action}:`));
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
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
