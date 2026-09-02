import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputChanges, outputJson, outputSuccess } from "../../core/output.js";
import { resolveTaskRef } from "../../core/short-ids.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { confirmOption, requireConfirm } from "../options/common.js";
import { readTaskEdits, taskEditOptions } from "../options/task-fields.js";

export function registerProcessCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("process")
		.description("Process an inbox item")
		.argument("<ref>", "Inbox item, short id or OmniFocus id");
	taskEditOptions(cmd)
		.option("--complete", "Mark as complete")
		.option("--delete", "Delete the item")
		.option("--dry-run", "Show what would change without applying");
	confirmOption(cmd, "Confirm deletion, required with --delete");
	cmd.action(
		runAction(async (ctx, ref: string) => {
			const opts = ctx.opts;
			if (opts.delete && !opts.dryRun) requireConfirm(opts, "inbox process --delete");
			const data = unwrapBridgeResponse(
				await client.processInbox({
					id: resolveTaskRef(ref).id ?? ref,
					...readTaskEdits(opts),
					complete: opts.complete as boolean | undefined,
					delete: opts.delete as boolean | undefined,
					dryRun: opts.dryRun as boolean | undefined,
					confirm: opts.confirm as boolean | undefined,
				}),
			);
			if (ctx.format === "json") {
				outputJson(data);
				return;
			}
			if (opts.dryRun) outputSuccess("Dry run - changes that would be made:");
			else if (opts.delete) outputSuccess(`Deleted inbox item: ${ref}`);
			else if (opts.complete) outputSuccess(`Completed inbox item: ${ref}`);
			else outputSuccess(`Processed inbox item: ${ref}`);
			if (data.changes && data.changes.length > 0) outputChanges("inbox item", ref, data.changes);
		}),
	);
}
