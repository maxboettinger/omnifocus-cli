/**
 * JXA Bridge — the sole interface between TypeScript and OmniFocus.
 *
 * Calls osascript with the bridge.js script, passing a JSON command
 * and parsing the JSON response. All OmniFocus communication goes
 * through this single choke point.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
// Embedded as text so the compiled standalone binary carries the script;
// a filesystem path would point into Bun's virtual /$bunfs/, invisible to osascript.
import rawBridgeSource from "../jxa/bridge.js" with { type: "text" };
import { JXAExecutionError } from "./errors.js";
import type { BridgeCommand, BridgeResponse } from "./types.js";

const execFileAsync = promisify(execFile);

// osascript -e does not strip the shebang the way it does for script files
const BRIDGE_SOURCE = rawBridgeSource.replace(/^#![^\n]*\n/, "");
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
		const args = ["-l", "JavaScript", "-e", BRIDGE_SOURCE, commandJson];

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
