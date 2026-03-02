import type { Command } from "commander";
import type { OmniFocusClient } from "../../core/types.js";
import { registerAddCommand } from "./add.js";
import { registerListCommand } from "./list.js";

export function registerFolderCommands(program: Command, client: OmniFocusClient): void {
	const cmd = program.command("folder").description("Manage folders");

	registerAddCommand(cmd, client);
	registerListCommand(cmd, client);
}
