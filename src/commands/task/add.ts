import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import { outputError, outputJson, outputTaskDetail, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create a task")
		.argument("<name>", "The task name")
		.option("--note <text>", "Task note")
		.option("--due <date>", "Due date")
		.option("--defer <date>", "Defer date")
		.option("--planned <date>", "Planned date")
		.option("--tag <name>", "Apply tag (repeatable)", collect, [])
		.option("--flag", "Flag the task")
		.option("--estimate <minutes>", "Estimated minutes", Number.parseInt)
		.option("--project <name>", "Project name")
		.option("--sequential", "Make task sequential")
		.option("--repeat <rrule>", "Repetition rule")
		.option("--repeat-method <method>", "Repetition method")
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.createTask({
					name,
					note: opts.note as string,
					due: opts.due as string,
					defer: opts.defer as string,
					planned: opts.planned as string,
					tags: opts.tag as string[],
					flag: opts.flag as boolean,
					estimate: opts.estimate as number,
					project: opts.project as string,
					sequential: opts.sequential as boolean,
					repeat: opts.repeat as string,
					repeatMethod: opts.repeatMethod as string,
				});

				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputTaskDetail(data.task, format);
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
