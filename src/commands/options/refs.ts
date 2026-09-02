/**
 * Entity-reference arguments. A task is referenced by `<ref>` — a short id
 * from a human listing, a name query, or a raw OmniFocus id — plus an
 * explicit `--id`. Projects take `<project>` + `--id`. Declaring them here
 * keeps every verb's wording and resolution identical.
 */

import type { Command } from "commander";
import { type TaskRef, resolveTaskRef } from "../../core/short-ids.js";

export type RefShape = "optional" | "required" | "variadic";

const TASK_REF_HELP = "Task reference: short id, name or OmniFocus id";

export function taskRefArgument(cmd: Command, shape: RefShape = "optional"): Command {
	switch (shape) {
		case "required":
			return cmd.argument("<ref>", TASK_REF_HELP).option("--id <id>", "Task ID");
		case "variadic":
			return cmd
				.argument("[refs...]", `${TASK_REF_HELP}s, omit with --id`)
				.option("--id <id>", "Task ID, single task only");
		default:
			return cmd
				.argument("[ref]", `${TASK_REF_HELP}, omit with --id`)
				.option("--id <id>", "Task ID");
	}
}

/** Resolve a task positional plus the parsed `--id` into the client's `{ query, id }`. */
export function readTaskRef(ref: string | undefined, opts: Record<string, unknown>): TaskRef {
	return resolveTaskRef(ref, opts.id as string | undefined);
}

export function projectRefArgument(
	cmd: Command,
	shape: Exclude<RefShape, "variadic"> = "required",
): Command {
	const help = "Project name or search query";
	return (
		shape === "required"
			? cmd.argument("<project>", help)
			: cmd.argument("[project]", `${help}, omit with --id`)
	).option("--id <id>", "Project ID");
}
