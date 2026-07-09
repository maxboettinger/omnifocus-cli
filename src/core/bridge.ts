/**
 * JXA Bridge — the sole interface between TypeScript and OmniFocus.
 *
 * Calls osascript with the bridge.js script, passing a JSON command
 * and parsing the JSON response. All OmniFocus communication goes
 * through this single choke point.
 */

import { execFile } from "node:child_process";
// Embedded as text so the compiled standalone binary carries the script;
// a filesystem path would point into Bun's virtual /$bunfs/, invisible to osascript.
import rawBridgeSource from "../jxa/bridge.js" with { type: "text" };
import { CLIError, JXAExecutionError, matchKnownBridgeFailure } from "./errors.js";
import type { BridgeCommand, BridgeResponse } from "./types.js";

// osascript -e does not strip the shebang the way it does for script files
const BRIDGE_SOURCE = rawBridgeSource.replace(/^#![^\n]*\n/, "");
const DEFAULT_TIMEOUT_MS = 30_000;

// Commands beyond this size are piped through stdin instead of argv:
// the kernel rejects overlong argv entries (ARG_MAX), which bulk ops or
// tasks with very long notes could otherwise hit.
const ARGV_COMMAND_LIMIT = 128 * 1024;

/** The osascript binary; overridable for tests (see test/core/bridge.test.ts). */
function bridgeBinary(): string {
	return process.env.OF_BRIDGE_BIN ?? "/usr/bin/osascript";
}

interface ExecResult {
	stdout: string;
	stderr: string;
}

interface ExecFailure {
	code?: string;
	killed?: boolean;
	stderr?: string;
	message?: string;
}

/**
 * Run the bridge binary, writing `stdinData` (if any) to its stdin.
 * Async execFile has no `input` option (that's execFileSync-only), so the
 * child's stdin pipe is driven explicitly — and always closed, otherwise a
 * bridge reading stdin would block forever.
 */
function execBridgeProcess(
	args: string[],
	opts: { timeout: number; maxBuffer: number },
	stdinData?: string,
): Promise<ExecResult> {
	return new Promise((resolve, reject) => {
		const child = execFile(bridgeBinary(), args, opts, (error, stdout, stderr) => {
			if (error) {
				// execFile's error lacks stderr; attach it for the caller's diagnostics
				(error as ExecFailure).stderr = stderr;
				reject(error);
				return;
			}
			resolve({ stdout, stderr });
		});
		if (child.stdin) {
			if (stdinData !== undefined) child.stdin.write(stdinData);
			child.stdin.end();
		}
	});
}

/**
 * Execute a JXA bridge command and return the typed response.
 *
 * @param command - The operation name and parameters.
 * @param opts - Optional: timeout in ms.
 * @returns Parsed JSON response from bridge.js.
 * @throws JXAExecutionError if osascript fails.
 */
export async function executeBridge<T = unknown>(
	command: BridgeCommand,
	opts?: { timeoutMs?: number },
): Promise<BridgeResponse<T>> {
	if (process.platform !== "darwin" && !process.env.OF_BRIDGE_BIN) {
		throw new CLIError(
			"omnifocus-cli requires macOS — it controls OmniFocus.app via Apple Events (osascript).",
		);
	}

	const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const commandJson = JSON.stringify(command);
	const viaStdin = commandJson.length > ARGV_COMMAND_LIMIT;

	try {
		const args = ["-l", "JavaScript", "-e", BRIDGE_SOURCE, viaStdin ? "@stdin" : commandJson];

		const { stdout, stderr } = await execBridgeProcess(
			args,
			{
				timeout: timeoutMs,
				maxBuffer: 10 * 1024 * 1024, // 10MB for large list results
			},
			viaStdin ? commandJson : undefined,
		);

		if (stderr?.trim()) {
			// osascript may write warnings to stderr even on success
			// Only treat as error if stdout is empty
			if (!stdout.trim()) {
				throw new JXAExecutionError(
					matchKnownBridgeFailure(stderr) ?? `JXA execution failed: ${stderr.trim()}`,
					stderr,
				);
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

		const err = error as ExecFailure;

		if (err.killed || err.code === "ETIMEDOUT") {
			throw new JXAExecutionError(
				`OmniFocus did not respond within ${timeoutMs / 1000}s. Is it running?`,
				"",
			);
		}

		if (err.stderr) {
			throw new JXAExecutionError(
				matchKnownBridgeFailure(err.stderr) ?? `JXA execution failed: ${err.stderr.trim()}`,
				err.stderr,
			);
		}

		throw new JXAExecutionError(`JXA execution failed: ${err.message ?? "unknown error"}`, "");
	}
}
