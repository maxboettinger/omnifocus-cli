/**
 * Shared stdin reader for commands that take a JSON payload on stdin
 * (bulk create/update/complete, inbox process-many).
 */

import { CLIError } from "./errors.js";

/**
 * Read stdin to EOF. Fails fast when stdin is an interactive terminal —
 * otherwise the command would hang forever waiting for input.
 *
 * @param example - Example invocation shown in the error, e.g.
 *   `echo '[{"name":"Task"}]' | of bulk create`
 */
export async function readStdin(example: string): Promise<string> {
	if (process.stdin.isTTY) {
		throw new CLIError(
			`No input on stdin — this command reads a JSON payload from stdin.\nExample: ${example}`,
		);
	}
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString("utf-8");
}
