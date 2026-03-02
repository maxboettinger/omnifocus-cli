import type { Command } from "commander";
import type { OmniFocusClient } from "../../core/types.js";
import { registerBulkCompleteCommand } from "./complete.js";
import { registerBulkCreateCommand } from "./create.js";
import { registerBulkUpdateCommand } from "./update.js";

export function registerBulkCommands(program: Command, client: OmniFocusClient): void {
	const bulkCmd = program.command("bulk").description("Bulk operations (stdin JSON)");

	registerBulkCreateCommand(bulkCmd, client);
	registerBulkUpdateCommand(bulkCmd, client);
	registerBulkCompleteCommand(bulkCmd, client);
}
