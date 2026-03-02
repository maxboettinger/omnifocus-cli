import type { Command } from "commander";
import type { OmniFocusClient } from "../../core/types.js";
import { registerAddCommand } from "./add.js";
import { registerCompleteCommand } from "./complete.js";
import { registerListCommand } from "./list.js";
import { registerSearchCommand } from "./search.js";
import { registerShowCommand } from "./show.js";
import { registerSubtaskCommand } from "./subtask.js";
import { registerTagCommand } from "./tag.js";
import { registerUpdateCommand } from "./update.js";

export function registerTaskCommands(program: Command, client: OmniFocusClient): void {
	const cmd = program.command("task").description("Manage tasks");

	registerAddCommand(cmd, client);
	registerListCommand(cmd, client);
	registerUpdateCommand(cmd, client);
	registerCompleteCommand(cmd, client);
	registerSearchCommand(cmd, client);
	registerShowCommand(cmd, client);
	registerSubtaskCommand(cmd, client);
	registerTagCommand(cmd, client);
}
