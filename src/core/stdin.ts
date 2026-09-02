/**
 * Shared stdin reader for commands that take a JSON payload on stdin
 * (bulk add/update/complete, inbox process-many).
 */

import { CLIError } from "./errors.js";

/**
 * Read stdin to EOF. Fails fast when stdin is an interactive terminal —
 * otherwise the command would hang forever waiting for input.
 *
 * @param example - Example invocation shown in the error, e.g.
 *   `echo '[{"name":"Task"}]' | of bulk add`
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

/**
 * Read a JSON array payload from stdin and validate its shape. Every
 * stdin-driven verb (bulk add/update/complete, inbox process-many) goes
 * through here so the error wording is identical.
 *
 * @param itemLabel - plural noun for messages, e.g. "task objects"
 * @param validateItem - optional per-item check returning an error message
 */
export async function readJsonArray<T>(
	example: string,
	itemLabel: string,
	validateItem?: (item: T, index: number) => string | undefined,
): Promise<T[]> {
	const input = await readStdin(example);
	if (!input.trim()) {
		throw new CLIError(`No input provided. Expected JSON array of ${itemLabel} on stdin.`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch (error) {
		throw new CLIError(
			`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!Array.isArray(parsed)) throw new CLIError(`Input must be an array of ${itemLabel}`);
	if (parsed.length === 0) throw new CLIError("Input array is empty");
	if (validateItem) {
		for (let i = 0; i < parsed.length; i++) {
			const problem = validateItem(parsed[i] as T, i);
			if (problem) throw new CLIError(problem);
		}
	}
	return parsed as T[];
}
