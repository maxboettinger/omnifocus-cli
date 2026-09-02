import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { CLIError } from "../../core/errors.js";
import { type DateField, outputJson, outputMoved } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";
import { taskDateOptions } from "../options/task-fields.js";

/**
 * `of task move <ref> [due]` (also `of t move`). Reschedules a task: the
 * positional date sets the due date; `--defer` / `--planned` set the other
 * fields and can be combined.
 * Dates accept anything OmniFocus's own date fields accept ("tomorrow",
 * "fri 5pm", "2d", "10.9.") plus ISO forms; `clear` removes a date. The
 * bridge resolves, stores and reads back every date, so the confirmation
 * shows what OmniFocus actually holds.
 */
export function registerMoveCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("move").description("Reschedule a task due, defer or planned date");
	taskRefArgument(cmd);
	cmd.argument("[due]", "New due date, e.g. tomorrow, 'fri 5pm', 2d, 2026-09-10, clear");
	taskDateOptions(cmd, { fields: ["defer", "planned"], clearable: true });
	cmd.action(
		runAction(async (ctx, ...positionals: (string | undefined)[]) => {
			const explicitId = ctx.opts.id as string | undefined;
			// With --id the task is already known, so a sole positional is the date:
			// `of move --id abc tomorrow`. Otherwise positionals are <ref> [due].
			const given = positionals.filter((p): p is string => p !== undefined);
			const [ref, due] = explicitId && given.length === 1 ? [undefined, given[0]] : positionals;
			const defer = ctx.opts.defer as string | undefined;
			const planned = ctx.opts.planned as string | undefined;
			if (!due && !defer && !planned) {
				throw new CLIError(
					"Nothing to move: give a due date (e.g. `of move 42 tomorrow`) and/or --defer/--planned",
				);
			}

			const resolved = readTaskRef(ref, ctx.opts);
			const response = await client.updateTask({
				query: ref as string,
				id: resolved.id,
				due,
				defer,
				planned,
			});
			const data = unwrapBridgeResponse(response);

			if (ctx.format === "json") {
				outputJson(data);
				return;
			}

			const fields: DateField[] = [];
			if (due) fields.push("due");
			if (defer) fields.push("defer");
			if (planned) fields.push("planned");
			outputMoved(data.task, fields);
		}),
	);
}
