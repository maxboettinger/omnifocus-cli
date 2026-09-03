#!/usr/bin/env bun
/**
 * OmniFocus CLI — Professional task management from the terminal.
 *
 * Entry point: builds the program (see program.ts) and runs it with
 * global error handling.
 */

import { createAIClient } from "./core/ai/client.js";
import { createClient } from "./core/client.js";
import { CLIError } from "./core/errors.js";
import { outputError } from "./core/output.js";
import { withProgress } from "./core/ui/progress.js";
import { buildProgram } from "./program.js";

// The progress decorator is the only UI concern wired at the entry point:
// every bridge round-trip gets a stderr spinner in human mode (see ui/progress).
// The AI client is lazy: nothing is resolved or loaded until a verb uses it.
const program = buildProgram(withProgress(createClient()), createAIClient());

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
