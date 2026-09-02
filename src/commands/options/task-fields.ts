/**
 * Task field option groups — the single declaration of the flags that
 * describe a task (dates, note, tags, flag, estimate, container, repeat)
 * for creating and for editing, plus readers that map parsed opts onto the
 * client's parameter types. Consumers: task add (also mounted as inbox add),
 * task update, task move, inbox process.
 */

import type { Command } from "commander";
import type { DateField } from "../../core/output.js";
import { collectRepeatable, parseIntOption, parseIntOrClear } from "../../core/parsers.js";
import { resolveTaskRef } from "../../core/short-ids.js";
import type { TaskCreateOptions, TaskUpdateOptions } from "../../core/types.js";

const ALL_DATE_FIELDS: readonly DateField[] = ["due", "defer", "planned"];
const DATE_LABEL: Record<DateField, string> = {
	due: "Due date",
	defer: "Defer date",
	planned: "Planned date",
};

export interface TaskDateOptionsConfig {
	/** Which of due/defer/planned to declare. Default: all three. */
	fields?: readonly DateField[];
	/** Mention that `clear` removes the date. Default: false. */
	clearable?: boolean;
}

export function taskDateOptions(cmd: Command, config: TaskDateOptionsConfig = {}): Command {
	const { fields = ALL_DATE_FIELDS, clearable = false } = config;
	for (const field of fields) {
		const help = clearable ? `${DATE_LABEL[field]}, or clear to remove` : DATE_LABEL[field];
		cmd.option(`--${field} <date>`, help);
	}
	return cmd;
}

export type TaskDates = Pick<TaskUpdateOptions, DateField>;

export function readTaskDates(opts: Record<string, unknown>): TaskDates {
	return {
		due: opts.due as string | undefined,
		defer: opts.defer as string | undefined,
		planned: opts.planned as string | undefined,
	};
}

export function taskCreateOptions(cmd: Command): Command {
	taskDateOptions(cmd);
	return cmd
		.option("--note <text>", "Task note")
		.option("--tag <name>", "Apply tag, repeatable", collectRepeatable, [])
		.option("--flag", "Flag the task")
		.option("--estimate <minutes>", "Estimated minutes", parseIntOption)
		.option("--project <name>", "Create inside this project")
		.option("--parent <ref>", "Create as a subtask of this task, short id, name or OmniFocus id")
		.option("--parent-id <id>", "Create as a subtask of this task ID")
		.option("--sequential", "Make the task sequential")
		.option("--repeat <rrule>", "Repetition rule")
		.option("--repeat-method <method>", "Repetition method");
}

export function readTaskCreate(name: string, opts: Record<string, unknown>): TaskCreateOptions {
	const parentRef = resolveTaskRef(
		opts.parent as string | undefined,
		opts.parentId as string | undefined,
	);
	return {
		name,
		note: opts.note as string | undefined,
		...readTaskDates(opts),
		tags: opts.tag as string[],
		flag: opts.flag as boolean | undefined,
		estimate: opts.estimate as number | undefined,
		project: opts.project as string | undefined,
		parent: parentRef.id ? undefined : parentRef.query,
		parentId: parentRef.id,
		sequential: opts.sequential as boolean | undefined,
		repeat: opts.repeat as string | undefined,
		repeatMethod: opts.repeatMethod as string | undefined,
	};
}

export function taskEditOptions(cmd: Command): Command {
	taskDateOptions(cmd, { clearable: true });
	return cmd
		.option("--name <name>", "New name")
		.option("--note <text>", "Replace the note")
		.option("--note-append <text>", "Append to the note")
		.option("--tag <name>", "Apply tag, repeatable", collectRepeatable, [])
		.option("--remove-tag <name>", "Remove tag, repeatable", collectRepeatable, [])
		.option("--flag", "Flag the task")
		.option("--unflag", "Remove the flag")
		.option("--estimate <minutes>", "Estimated minutes, or clear to remove", parseIntOrClear)
		.option("--project <name>", "Move to this project")
		.option("--sequential", "Make sequential")
		.option("--parallel", "Make parallel")
		.option("--repeat <rrule>", "Repetition rule, or clear to remove")
		.option("--repeat-method <method>", "Repetition method");
}

export type TaskEdits = Omit<TaskUpdateOptions, "id" | "query" | "complete" | "incomplete">;

export function readTaskEdits(opts: Record<string, unknown>): TaskEdits {
	return {
		name: opts.name as string | undefined,
		note: opts.note as string | undefined,
		noteAppend: opts.noteAppend as string | undefined,
		...readTaskDates(opts),
		flag: opts.flag as boolean | undefined,
		unflag: opts.unflag as boolean | undefined,
		estimate: opts.estimate as number | "clear" | undefined,
		tags: opts.tag as string[],
		removeTags: opts.removeTag as string[],
		project: opts.project as string | undefined,
		sequential: opts.sequential as boolean | undefined,
		parallel: opts.parallel as boolean | undefined,
		repeat: opts.repeat as string | undefined,
		repeatMethod: opts.repeatMethod as string | undefined,
	};
}
