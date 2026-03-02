import type { Command } from "commander";
import type { OmniFocusClient } from "../../core/types.js";
import { registerAddCommand } from "./add.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerRenameCommand } from "./rename.js";
import { registerShowCommand } from "./show.js";
import { registerUpdateCommand } from "./update.js";

export function registerProjectCommands(program: Command, client: OmniFocusClient): void {
	const cmd = program.command("project").description("Manage projects");

	registerAddCommand(cmd, client);
	registerListCommand(cmd, client);
	registerShowCommand(cmd, client);
	registerUpdateCommand(cmd, client);
	registerRenameCommand(cmd, client);
	registerDeleteCommand(cmd, client);
}
