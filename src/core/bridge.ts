/**
 * JXA Bridge — the sole interface between TypeScript and OmniFocus.
 *
 * Calls osascript with the bridge.js script, passing a JSON command
 * and parsing the JSON response. All OmniFocus communication goes
 * through this single choke point.
 */

import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { JXAExecutionError } from "./errors.js";
import type { BridgeCommand, BridgeResponse } from "./types.js";

const execFileAsync = promisify(execFile);

const BRIDGE_SCRIPT = resolve(import.meta.dirname, "../jxa/bridge.js");
const OSASCRIPT = "/usr/bin/osascript";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Execute a JXA bridge command and return the typed response.
 *
 * @param command - The operation name and parameters.
 * @param opts - Optional: timeout in ms, stdin data for bulk ops.
 * @returns Parsed JSON response from bridge.js.
 * @throws JXAExecutionError if osascript fails.
 */
export async function executeBridge<T = unknown>(
	command: BridgeCommand,
	opts?: { timeoutMs?: number; stdin?: string },
): Promise<BridgeResponse<T>> {
	const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const commandJson = JSON.stringify(command);

	try {
		const args = ["-l", "JavaScript", BRIDGE_SCRIPT, commandJson];

		const childOpts: { timeout: number; maxBuffer: number; input?: string } = {
			timeout: timeoutMs,
			maxBuffer: 10 * 1024 * 1024, // 10MB for large list results
		};

		if (opts?.stdin) {
			childOpts.input = opts.stdin;
		}

		const { stdout, stderr } = await execFileAsync(OSASCRIPT, args, childOpts);

		if (stderr?.trim()) {
			// osascript may write warnings to stderr even on success
			// Only treat as error if stdout is empty
			if (!stdout.trim()) {
				throw new JXAExecutionError(`JXA execution failed: ${stderr.trim()}`, stderr);
			}
		}

		const trimmed = stdout.trim();
		if (!trimmed) {
			throw new JXAExecutionError("JXA bridge returned empty response", "");
		}

		const parsed: unknown = JSON.parse(trimmed);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("ok" in parsed) ||
			typeof (parsed as { ok: unknown }).ok !== "boolean"
		) {
			throw new JXAExecutionError(
				"JXA bridge returned malformed response (missing 'ok' field)",
				trimmed,
			);
		}
		return parsed as BridgeResponse<T>;
	} catch (error) {
		if (error instanceof JXAExecutionError) throw error;

		const err = error as { code?: string; killed?: boolean; stderr?: string; message?: string };

		if (err.killed || err.code === "ETIMEDOUT") {
			throw new JXAExecutionError(
				`OmniFocus did not respond within ${timeoutMs / 1000}s. Is it running?`,
				"",
			);
		}

		if (err.stderr) {
			throw new JXAExecutionError(`JXA execution failed: ${err.stderr.trim()}`, err.stderr);
		}

		throw new JXAExecutionError(`JXA execution failed: ${err.message ?? "unknown error"}`, "");
	}
}

/**
 * Convenience: execute bridge and unwrap data, throwing on error responses.
 */
export async function executeBridgeOrThrow<T>(
	command: BridgeCommand,
	opts?: { timeoutMs?: number; stdin?: string },
): Promise<T> {
	const { unwrapBridgeResponse } = await import("./client.js");
	const response = await executeBridge<T>(command, opts);
	return unwrapBridgeResponse(response);
}
