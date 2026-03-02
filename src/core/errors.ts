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

	/** Format for human display including disambiguation candidates. */
	format(): string {
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
				if (c.id) parts.push(`(${c.id})`);
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

/** Multiple entities matched a query — user must disambiguate. */
export class AmbiguousMatchError extends BridgeError {
	constructor(entity: string, query: string, candidates: BridgeCandidate[]) {
		super(
			`Ambiguous: multiple ${entity}s match "${query}". Be more specific or use --id.`,
			candidates,
		);
		this.name = "AmbiguousMatchError";
	}
}

/** Entity not found. */
export class NotFoundError extends BridgeError {
	constructor(entity: string, query: string) {
		super(`${entity} not found: "${query}"`);
		this.name = "NotFoundError";
	}
}

/** Required argument missing. */
export class MissingArgumentError extends CLIError {
	constructor(argName: string) {
		super(`Missing required argument: ${argName}`, 2);
		this.name = "MissingArgumentError";
	}
}

/** Destructive operation requires --confirm. */
export class ConfirmationRequiredError extends CLIError {
	constructor(action: string) {
		super(`${action} requires --confirm flag for safety`);
		this.name = "ConfirmationRequiredError";
	}
}
