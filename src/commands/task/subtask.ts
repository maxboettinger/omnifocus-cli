import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputJson, outputSuccess, resolveFormat } from "../../core/output.js";
import { parseIntOption } from "../../core/parsers.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerSubtaskCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("subtask")
		.description("Add a subtask")
		.argument("<name>", "The subtask name")
		.option("--parent <query>", "Parent task query")
		.option("--parent-id <id>", "Parent task ID")
		.option("--note <text>", "Subtask note")
		.option("--due <date>", "Due date")
		.option("--defer <date>", "Defer date")
		.option("--planned <date>", "Planned date")
		.option("--tag <name>", "Apply tag (repeatable)", collect, [])
		.option("--flag", "Flag the subtask")
		.option("--estimate <minutes>", "Estimated minutes", parseIntOption)
		.option("--sequential", "Make subtask sequential")
		.option("--repeat <rrule>", "Repetition rule")
		.option("--repeat-method <method>", "Repetition method")
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.createSubtask({
					name,
					parent: opts.parent as string,
					parentId: opts.parentId as string,
					note: opts.note as string,
					due: opts.due as string,
					defer: opts.defer as string,
					planned: opts.planned as string,
					tags: opts.tag as string[],
					flag: opts.flag as boolean,
					estimate: opts.estimate as number,
					sequential: opts.sequential as boolean,
					repeat: opts.repeat as string,
					repeatMethod: opts.repeatMethod as string,
				});

				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`Created subtask: ${data.name}`);
				outputSuccess(`  Parent: ${data.parent.name} [${data.parent.project}]`);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}

function collect(val: string, prev: string[]): string[] {
	return [...prev, val];
}
