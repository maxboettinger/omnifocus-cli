import type { BridgeCandidate } from "./types.js";

/**
 * Error hierarchy for OmniFocus CLI.
 *
 * All errors in the application extend CLIError, which carries
 * a user-facing message and an exit code.
 */

export class CLIError extends Error {
	readonly exitCode: number;

	constructor(message: string, exitCode = 1) {
		super(message);
		this.name = "CLIError";
		this.exitCode = exitCode;
	}
}

/** The JXA bridge returned { ok: false }. */
export class BridgeError extends CLIError {
	readonly candidates?: BridgeCandidate[];

	constructor(message: string, candidates?: BridgeCandidate[]) {
		super(message);
		this.name = "BridgeError";
		this.candidates = candidates;
	}

	/**
	 * Format for human display including disambiguation candidates. When a
	 * short-id alias map is provided, candidates show the retryable short
	 * number instead of the raw OmniFocus id.
	 */
	format(shortIds?: ReadonlyMap<string, number>): string {
		let msg = this.message;
		if (this.candidates && this.candidates.length > 0) {
			msg += "\n\nDid you mean:";
			for (const c of this.candidates) {
				if (typeof c === "string") {
					msg += `\n  - ${c}`;
					continue;
				}
				const parts = [c.name];
				if (c.project) parts.push(`[${c.project}]`);
				if (c.id) parts.push(`(${shortIds?.get(c.id) ?? c.id})`);
				msg += `\n  - ${parts.join(" ")}`;
			}
		}
		return msg;
	}
}

/** osascript process failed (non-zero exit, timeout, etc.). */
export class JXAExecutionError extends CLIError {
	readonly stderr: string;

	constructor(message: string, stderr: string) {
		super(message);
		this.name = "JXAExecutionError";
		this.stderr = stderr;
	}
}

/** Destructive operation requires --confirm. */
export class ConfirmationRequiredError extends CLIError {
	constructor(action: string) {
		super(`${action} requires --confirm flag for safety`);
		this.name = "ConfirmationRequiredError";
	}
}

// ── Known first-run failure mapping ─────────────────────────────────────────

const AUTOMATION_PERMISSION_HELP = [
	"Not authorized to control OmniFocus via Apple Events (macOS error -1743).",
	"Grant permission in System Settings → Privacy & Security → Automation:",
	"find your terminal app in the list and enable OmniFocus, then re-run the command.",
].join("\n");

const OMNIFOCUS_MISSING_HELP = [
	"OmniFocus could not be found. This CLI controls OmniFocus for Mac via Apple Events,",
	"so OmniFocus must be installed: https://www.omnigroup.com/omnifocus/",
].join("\n");

/**
 * Recognize well-known environment failures (buried in raw JXA/osascript
 * error text) and translate them into actionable guidance. Returns null
 * when the failure is not one of the known cases.
 */
export function matchKnownBridgeFailure(raw: string): string | null {
	if (/not authorized to send apple events|-1743/i.test(raw)) {
		return AUTOMATION_PERMISSION_HELP;
	}
	if (
		/application can't be found|OmniFocus could not be opened|can't find application/i.test(raw)
	) {
		return OMNIFOCUS_MISSING_HELP;
	}
	return null;
}
