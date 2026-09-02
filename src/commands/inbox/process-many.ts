import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputBatchSummary, outputJson } from "../../core/output.js";
import { readJsonArray } from "../../core/stdin.js";
import type { InboxProcessOptions, OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";

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

function wantsDelete(item: unknown): boolean {
	return Boolean(item && typeof item === "object" && (item as Record<string, unknown>).delete);
}

export function registerProcessManyCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("process-many")
		.description("Process many inbox items from stdin JSON");
	confirmOption(cmd, "Confirm deletion of any items with delete true");
	cmd.action(
		runAction(async (ctx) => {
			const items = await readJsonArray<unknown>(
				`echo '[{"id":"id1","project":"Errands"}]' | of inbox process-many`,
				"inbox process objects",
			);
			// Reject the whole batch up front rather than failing partway through.
			if (items.some(wantsDelete)) requireConfirm(ctx.opts, "inbox process-many with delete items");

			const results: BatchProcessResult[] = [];
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (!hasValidId(item)) {
					results.push({ ok: false, error: `Item at index ${i} is missing required field 'id'` });
					continue;
				}
				// Confirm provenance must come from --confirm only; never trust a
				// caller-supplied `confirm` field in stdin JSON.
				const processOptions = {
					...(item as InboxProcessOptions),
					confirm: ctx.opts.confirm === true,
				} as InboxProcessOptions;
				try {
					const data = unwrapBridgeResponse(await client.processInbox(processOptions));
					results.push({ ok: true, id: item.id, taskName: data.task?.name, changes: data.changes });
				} catch (error) {
					if (error instanceof BridgeError) {
						results.push({ ok: false, id: item.id, error: error.format() });
						continue;
					}
					throw error;
				}
			}

			if (ctx.format === "json") {
				outputJson(results);
				return;
			}
			const summary = outputBatchSummary(
				"Inbox batch processing completed",
				results.map((r) => ({ ...r, name: r.taskName })),
			);
			if (summary.failed > 0) process.exit(1);
		}),
	);
}
