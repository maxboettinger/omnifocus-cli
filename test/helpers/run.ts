/**
 * The single CLI test harness: run a command group against a mock client
 * and capture what it printed. Builds a real Commander program with the
 * root `--json` option (mirroring src/program.ts) and exitOverride(),
 * captures console.log/console.error into arrays, and stubs process.exit
 * so `exitCode` can be asserted instead of the process actually exiting.
 * `runCommandWithStdin` layers stdin piping on top for stdin-driven verbs
 * (bulk add/update/complete, inbox process-many).
 *
 * Integration test files import this rather than building their own copy.
 */

import { Readable } from "node:stream";
import { Command } from "commander";
import type { OmniFocusClient } from "../../src/core/types.js";
import { createMockClient } from "../fixtures/mock-client.js";
import { withStdin } from "./env.js";

export interface RunResult {
	client: OmniFocusClient;
	stdout: string[];
	stderr: string[];
	exitCode: number | undefined;
}

export async function runCommand(
	setup: (program: Command, client: OmniFocusClient) => void,
	argv: string[],
	client?: OmniFocusClient,
): Promise<RunResult> {
	const c = client ?? createMockClient();
	const program = new Command();
	// Mirror the real program: --json is a root option only (src/program.ts).
	program.name("of").option("--json", "Output in JSON format").exitOverride();
	setup(program, c);

	const stdout: string[] = [];
	const stderr: string[] = [];
	const origLog = console.log;
	const origErr = console.error;
	const origExit = process.exit;
	let exitCode: number | undefined;
	console.log = (...args: unknown[]) => {
		stdout.push(args.map(String).join(" "));
	};
	console.error = (...args: unknown[]) => {
		stderr.push(args.map(String).join(" "));
	};
	process.exit = ((code?: number) => {
		exitCode = code;
	}) as never;
	try {
		await program.parseAsync(argv, { from: "user" });
	} finally {
		console.log = origLog;
		console.error = origErr;
		process.exit = origExit;
	}
	return { client: c, stdout, stderr, exitCode };
}

/** `runCommand` with `stdinText` piped in as the command's stdin. */
export function runCommandWithStdin(
	setup: (program: Command, client: OmniFocusClient) => void,
	argv: string[],
	stdinText: string,
	client?: OmniFocusClient,
): Promise<RunResult> {
	return withStdin(Readable.from([Buffer.from(stdinText)]), () => runCommand(setup, argv, client));
}
