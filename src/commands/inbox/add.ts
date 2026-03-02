import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputJson, outputSuccess, outputTaskDetail, resolveFormat } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Quick-add item to inbox")
		.argument("<name>", "Task name")
		.option("--note <text>", "Task note")
		.option("--due <date>", "Due date")
		.option("--defer <date>", "Defer date")
		.option("--planned <date>", "Planned date")
		.option("--tag <name>", "Add tag (repeatable)", collect, [])
		.option("--flag", "Flag the task")
		.option("--estimate <minutes>", "Estimated minutes", Number.parseInt)
		.option("--project <name>", "Project name")
		.option("--repeat <rrule>", "Repetition rule")
		.option("--repeat-method <method>", "Repetition method")
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);
				const response = await client.addInbox({
					name,
					note: opts.note as string,
					due: opts.due as string,
					defer: opts.defer as string,
					planned: opts.planned as string,
					tags: opts.tag as string[],
					flag: opts.flag as boolean,
					estimate: opts.estimate as number,
					project: opts.project as string,
					repeat: opts.repeat as string,
					repeatMethod: opts.repeatMethod as string,
				});
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`Added to inbox: ${data.name}`);
				if (data.task) {
					console.log();
					console.log(outputTaskDetail(data.task, "human"));
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Error adding to inbox: ${message}`);
				process.exit(1);
			}
		});
}

function collect(value: string, previous: string[]): string[] {
	return previous.concat([value]);
}
