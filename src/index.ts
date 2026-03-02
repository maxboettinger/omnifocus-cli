#!/usr/bin/env bun
/**
 * OmniFocus CLI — Professional task management from the terminal.
 *
 * Entry point: assembles the Commander program with all command groups.
 */

import { Command } from "commander";
import { registerBulkCommands } from "./commands/bulk/index.js";
import { registerCompletionCommand } from "./commands/completion.js";
import { registerFolderCommands } from "./commands/folder/index.js";
import { registerForecastCommand } from "./commands/forecast.js";
import { registerInboxCommands } from "./commands/inbox/index.js";
import { registerProjectCommands } from "./commands/project/index.js";
import { registerReviewCommand } from "./commands/review.js";
import { registerStatsCommand } from "./commands/stats.js";
import { registerTagCommands } from "./commands/tag/index.js";
import { registerTaskCommands } from "./commands/task/index.js";
import { createClient } from "./core/client.js";
import { CLIError } from "./core/errors.js";
import { outputError } from "./core/output.js";

const program = new Command();

program
	.name("of")
	.description("Professional CLI for OmniFocus task management")
	.version("0.1.0")
	.option("--json", "Output in JSON format");

const client = createClient();

registerTaskCommands(program, client);
registerProjectCommands(program, client);
registerTagCommands(program, client);
registerFolderCommands(program, client);
registerInboxCommands(program, client);
registerBulkCommands(program, client);
registerForecastCommand(program, client);
registerReviewCommand(program, client);
registerStatsCommand(program, client);
registerCompletionCommand(program);

// Global error handler
program.exitOverride();

try {
	await program.parseAsync(process.argv);
} catch (error) {
	if (error instanceof CLIError) {
		outputError(error.message);
		process.exit(error.exitCode);
	}
	// Commander throws CommanderError for --help, --version, unknown commands
	const isCommanderExit =
		error instanceof Error &&
		"exitCode" in error &&
		typeof (error as { exitCode: unknown }).exitCode === "number";
	if (isCommanderExit) {
		process.exit((error as { exitCode: number }).exitCode);
	}
	outputError(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
