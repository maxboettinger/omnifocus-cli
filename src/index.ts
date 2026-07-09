#!/usr/bin/env bun
/**
 * OmniFocus CLI — Professional task management from the terminal.
 *
 * Entry point: builds the program (see program.ts) and runs it with
 * global error handling.
 */

import { createClient } from "./core/client.js";
import { CLIError } from "./core/errors.js";
import { outputError } from "./core/output.js";
import { buildProgram } from "./program.js";

const program = buildProgram(createClient());

// Global error handler
program.exitOverride();

try {
	await program.parseAsync(process.argv);
} catch (error) {
	if (error instanceof CLIError) {
		outputError(error);
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
