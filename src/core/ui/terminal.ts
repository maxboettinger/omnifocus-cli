/**
 * Terminal capability detection.
 *
 * Answers one question for the UI toolkit: may we draw live, in-place
 * chrome (spinners, cursor movement) on this stream? This is deliberately
 * stricter than "is it a TTY": CI logs and dumb terminals are TTYs that
 * cannot render redraws, so animated output there degrades into noise.
 *
 * Mirrors the convention used by yocto-spinner/ora so our gate and the
 * library's own gate never disagree.
 */

/** A stream that may or may not be an interactive terminal. */
export interface TerminalStream {
	isTTY?: boolean;
}

export function isInteractive(stream: TerminalStream): boolean {
	return stream.isTTY === true && process.env.TERM !== "dumb" && !("CI" in process.env);
}
