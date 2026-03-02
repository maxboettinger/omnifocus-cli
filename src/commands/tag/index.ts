import type { Command } from "commander";
import type { OmniFocusClient } from "../../core/types.js";
import { registerAddCommand } from "./add.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerRenameCommand } from "./rename.js";
import { registerTasksCommand } from "./tasks.js";

export function registerTagCommands(program: Command, client: OmniFocusClient): void {
	const cmd = program.command("tag").description("Manage tags");

	registerAddCommand(cmd, client);
	registerListCommand(cmd, client);
	registerRenameCommand(cmd, client);
	registerDeleteCommand(cmd, client);
	registerTasksCommand(cmd, client);
}
