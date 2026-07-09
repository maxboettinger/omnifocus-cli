import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError, ConfirmationRequiredError } from "../../core/errors.js";
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
import type { InboxProcessOptions, OmniFocusClient } from "../../core/types.js";

interface BatchProcessResult {
	ok: boolean;
	id?: string;
	error?: string;
	changes?: string[];
	taskName?: string;
}

function hasValidId(input: unknown): input is { id: string } {
	if (!input || typeof input !== "object") return false;
	const record = input as Record<string, unknown>;
	return typeof record.id === "string" && record.id.trim().length > 0;
}

export function registerProcessManyCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("process-many")
		.description("Process many inbox items from stdin JSON")
		.option("--confirm", "Confirm deletion of any items with delete: true")
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

			const input = await readStdin(
				`echo '[{"id":"id1","project":"Errands"}]' | of inbox process-many`,
			);
			if (!input.trim()) {
				outputError("No input provided. Expected JSON array of inbox process objects on stdin.");
				process.exit(1);
			}

			let items: unknown[];
			try {
				items = JSON.parse(input);
			} catch (parseError) {
				outputError(
					`Invalid JSON input: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				);
				process.exit(1);
			}

			if (!Array.isArray(items)) {
				outputError("Input must be an array of inbox process objects");
				process.exit(1);
			}

			if (items.length === 0) {
				outputError("Input array is empty");
				process.exit(1);
			}

			const hasDeleteItem = items.some(
				(item) =>
					item && typeof item === "object" && Boolean((item as Record<string, unknown>).delete),
			);
			if (hasDeleteItem && !opts.confirm) {
				outputError(new ConfirmationRequiredError("inbox process-many with delete items").message);
				process.exit(1);
				return;
			}

			const results: BatchProcessResult[] = [];

			for (let i = 0; i < items.length; i++) {
				const item = items[i];

				if (!hasValidId(item)) {
					results.push({
						ok: false,
						error: `Item at index ${i} is missing required field 'id'`,
					});
					continue;
				}

				// Confirm provenance must come from the --confirm flag only: never let a
				// caller-supplied `confirm` field in stdin JSON survive, since that would
				// bypass the delete confirmation guard above.
				const processOptions = {
					...(item as InboxProcessOptions),
					confirm: opts.confirm === true,
				} as InboxProcessOptions;

				try {
					const response = await client.processInbox(processOptions);
					const data = unwrapBridgeResponse(response);
					results.push({
						ok: true,
						id: item.id,
						taskName: data.task?.name,
						changes: data.changes,
					});
				} catch (error) {
					if (error instanceof BridgeError) {
						results.push({ ok: false, id: item.id, error: error.format() });
						continue;
					}
					throw error;
				}
			}

			if (format === "json") {
				outputJson(results);
				return;
			}

			const succeeded = results.filter((result) => result.ok);
			const failed = results.filter((result) => !result.ok);
			outputSuccess(
				`Inbox batch processing completed: ${succeeded.length} succeeded, ${failed.length} failed`,
			);

			if (succeeded.length > 0) {
				console.log(green(`\n✓ Successfully processed ${succeeded.length} inbox items:`));
				for (const result of succeeded) {
					console.log(`  ${result.taskName || result.id} (${result.id})`);
					if (result.changes && result.changes.length > 0) {
						for (const change of result.changes) {
							console.log(dim(`    • ${change}`));
						}
					}
				}
			}

			if (failed.length > 0) {
				console.log(red(`\n✗ Failed to process ${failed.length} inbox items:`));
				for (const result of failed) {
					console.log(`  ${result.id || "unknown"}: ${result.error}`);
				}
			}

			console.log(dim(`\nTotal: ${results.length} items processed`));

			if (failed.length > 0) {
				process.exit(1);
			}
		});
}
