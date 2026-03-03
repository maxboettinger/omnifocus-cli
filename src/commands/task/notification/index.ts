import type { Command } from "commander";
import type { OmniFocusClient } from "../../../core/types.js";
import { registerAddCommand } from "./add.js";
import { registerClearCommand } from "./clear.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerUpdateCommand } from "./update.js";

export function registerNotificationCommands(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("notification").description("Manage task notifications");

	registerListCommand(cmd, client);
	registerAddCommand(cmd, client);
	registerUpdateCommand(cmd, client);
	registerDeleteCommand(cmd, client);
	registerClearCommand(cmd, client);
}
