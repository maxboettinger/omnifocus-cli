import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputChanges, outputError, outputJson, resolveFormat } from "../../core/output.js";
import { resolveTaskRef } from "../../core/short-ids.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerUpdateCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("update")
		.description("Update a task")
		.argument("[query]", "Task query (can be omitted when using --id)")
		.option("--id <id>", "Task ID")
		.option("--name <name>", "Task name")
		.option("--note <text>", "Task note")
		.option("--note-append <text>", "Append to task note")
		.option("--due <date>", "Due date (use 'clear' to remove)")
		.option("--defer <date>", "Defer date (use 'clear' to remove)")
		.option("--planned <date>", "Planned date (use 'clear' to remove)")
		.option("--flag", "Flag the task")
		.option("--unflag", "Unflag the task")
		.option(
			"--estimate <minutes>",
			"Estimated minutes (use 'clear' to remove)",
			parseNumberOrString,
		)
		.option("--tag <name>", "Apply tag (repeatable)", collect, [])
		.option("--remove-tag <name>", "Remove tag (repeatable)", collect, [])
		.option("--project <name>", "Project name")
		.option("--sequential", "Make task sequential")
		.option("--parallel", "Make task parallel")
		.option("--repeat <rrule>", "Repetition rule (use 'clear' to remove)")
		.option("--repeat-method <method>", "Repetition method")
		.option("--complete", "Mark task as complete")
		.option("--incomplete", "Mark task as incomplete")
		.option("--json", "JSON output")
		.action(async (query: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const ref = resolveTaskRef(query, opts.id as string | undefined);
				const response = await client.updateTask({
					query,
					id: ref.id,
					name: opts.name as string,
					note: opts.note as string,
					noteAppend: opts.noteAppend as string,
					due: opts.due as string,
					defer: opts.defer as string,
					planned: opts.planned as string,
					flag: opts.flag as boolean,
					unflag: opts.unflag as boolean,
					estimate: opts.estimate as number | "clear",
					tags: opts.tag as string[],
					removeTags: opts.removeTag as string[],
					project: opts.project as string,
					sequential: opts.sequential as boolean,
					parallel: opts.parallel as boolean,
					repeat: opts.repeat as string,
					repeatMethod: opts.repeatMethod as string,
					complete: opts.complete as boolean,
					incomplete: opts.incomplete as boolean,
				});

				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputChanges("task", data.task?.name ?? data.id, data.changes);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}

function collect(val: string, prev: string[]): string[] {
	return [...prev, val];
}

function parseNumberOrString(value: string): number | string {
	if (value === "clear") {
		return "clear";
	}
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) {
		throw new Error(`Invalid number: ${value}`);
	}
	return parsed;
}
