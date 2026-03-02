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
import type { BulkCreateInput, OmniFocusClient } from "../../core/types.js";

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

export function registerBulkCreateCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("create")
		.description("Create tasks from stdin JSON")
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				// Read JSON from stdin
				const input = await readStdin();
				if (!input.trim()) {
					outputError("No input provided. Expected JSON array of task objects on stdin.");
					process.exit(1);
				}

				let tasks: BulkCreateInput[];
				try {
					tasks = JSON.parse(input);
				} catch (parseError) {
					outputError(
						`Invalid JSON input: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
					);
					process.exit(1);
				}

				if (!Array.isArray(tasks)) {
					outputError("Input must be an array of task objects");
					process.exit(1);
				}

				if (tasks.length === 0) {
					outputError("Input array is empty");
					process.exit(1);
				}

				// Validate required fields
				for (let i = 0; i < tasks.length; i++) {
					const task = tasks[i];
					if (!task || typeof task !== "object" || !task.name) {
						outputError(`Task at index ${i} is missing required field 'name'`);
						process.exit(1);
					}
				}

				const response = await client.bulkCreate(tasks);
				const results = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(results);
					return;
				}

				// Human-friendly output
				const succeeded = results.filter((r) => r.ok);
				const failed = results.filter((r) => !r.ok);

				outputSuccess(
					`Bulk create completed: ${succeeded.length} succeeded, ${failed.length} failed`,
				);

				if (succeeded.length > 0) {
					console.log(green(`\n✓ Successfully created ${succeeded.length} tasks:`));
					for (const result of succeeded) {
						console.log(`  ${result.name} (${result.id})`);
					}
				}

				if (failed.length > 0) {
					console.log(red(`\n✗ Failed to create ${failed.length} tasks:`));
					for (const result of failed) {
						console.log(`  ${result.name || "Unknown"}: ${result.error}`);
					}
				}

				console.log(dim(`\nTotal: ${results.length} tasks processed`));

				// Exit with error code if any failed
				if (failed.length > 0) {
					process.exit(1);
				}
			} catch (error) {
				outputError(
					`Bulk create failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				process.exit(1);
			}
		});
}
