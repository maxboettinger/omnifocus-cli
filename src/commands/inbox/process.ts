import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError, ConfirmationRequiredError } from "../../core/errors.js";
import {
	outputChanges,
	outputError,
	outputJson,
	outputSuccess,
	resolveFormat,
} from "../../core/output.js";
import { parseIntOption } from "../../core/parsers.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerProcessCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("process")
		.description("Process an inbox item")
		.argument("<id>", "Inbox item ID")
		.option("--name <name>", "Update name")
		.option("--note <text>", "Update note")
		.option("--note-append <text>", "Append to note")
		.option("--project <name>", "Move to project")
		.option("--tag <name>", "Add tag (repeatable)", collect, [])
		.option("--remove-tag <name>", "Remove tag (repeatable)", collect, [])
		.option("--due <date>", "Set due date")
		.option("--defer <date>", "Set defer date")
		.option("--planned <date>", "Set planned date")
		.option("--estimate <minutes>", "Set estimated minutes", parseIntOption)
		.option("--flag", "Flag the item")
		.option("--unflag", "Remove flag")
		.option("--sequential", "Make sequential")
		.option("--parallel", "Make parallel")
		.option("--repeat <rrule>", "Set repetition rule")
		.option("--repeat-method <method>", "Set repetition method")
		.option("--complete", "Mark as complete")
		.option("--delete", "Delete the item")
		.option("--dry-run", "Show what would be changed without applying")
		.option("--confirm", "Confirm deletion (required with --delete)")
		.option("--json", "JSON output")
		.action(async (id: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				if (opts.delete && !opts.dryRun && !opts.confirm) {
					outputError(new ConfirmationRequiredError("inbox process --delete").message);
					process.exit(1);
					return;
				}

				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.processInbox({
					id,
					name: opts.name as string,
					note: opts.note as string,
					noteAppend: opts.noteAppend as string,
					project: opts.project as string,
					tags: opts.tag as string[],
					removeTags: opts.removeTag as string[],
					due: opts.due as string,
					defer: opts.defer as string,
					planned: opts.planned as string,
					estimate: opts.estimate as number,
					flag: opts.flag as boolean,
					unflag: opts.unflag as boolean,
					sequential: opts.sequential as boolean,
					parallel: opts.parallel as boolean,
					repeat: opts.repeat as string,
					repeatMethod: opts.repeatMethod as string,
					complete: opts.complete as boolean,
					delete: opts.delete as boolean,
					dryRun: opts.dryRun as boolean,
					confirm: opts.confirm as boolean,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				if (opts.dryRun) {
					outputSuccess("Dry run - changes that would be made:");
				} else if (opts.delete) {
					outputSuccess(`Deleted inbox item: ${id}`);
				} else if (opts.complete) {
					outputSuccess(`Completed inbox item: ${id}`);
				} else {
					outputSuccess(`Processed inbox item: ${id}`);
				}

				if (data.changes && data.changes.length > 0) {
					outputChanges("inbox item", id, data.changes);
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

function collect(value: string, previous: string[]): string[] {
	return previous.concat([value]);
}
