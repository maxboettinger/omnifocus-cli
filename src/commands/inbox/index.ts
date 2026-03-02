import type { Command } from "commander";
import type { OmniFocusClient } from "../../core/types.js";
import { registerAddCommand } from "./add.js";
import { registerListCommand } from "./list.js";
import { registerProcessCommand } from "./process.js";

export function registerInboxCommands(program: Command, client: OmniFocusClient): void {
	const cmd = program.command("inbox").description("Manage inbox");

	registerListCommand(cmd, client);
	registerAddCommand(cmd, client);
	registerProcessCommand(cmd, client);
}
