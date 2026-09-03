/**
 * ANSI color primitives.
 *
 * The lowest layer of the terminal UI toolkit: pure string decoration with
 * standard color conventions, no knowledge of OmniFocus entities or output
 * formats. Higher layers (`../output.ts` renderers, command-level formatters)
 * compose these; nothing here writes to a stream.
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const STRIKE = "\x1b[9m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";

/**
 * Standard color conventions: NO_COLOR disables, FORCE_COLOR overrides,
 * otherwise color only when the target stream is a terminal. Checked per
 * call so tests (and long-lived processes) see env/TTY changes.
 */
export function colorEnabled(stream: NodeJS.WriteStream): boolean {
	const noColor = process.env.NO_COLOR;
	if (noColor !== undefined && noColor !== "") return false;
	const forceColor = process.env.FORCE_COLOR;
	if (forceColor !== undefined && forceColor !== "" && forceColor !== "0") return true;
	return stream.isTTY === true;
}

/** Wrap `s` in an ANSI code if color is enabled for `stream` (stdout by default). */
export function paint(
	code: string,
	s: string,
	stream: NodeJS.WriteStream = process.stdout,
): string {
	return colorEnabled(stream) ? `${code}${s}${RESET}` : s;
}

// Named helpers default to stdout, where human-formatted content goes;
// stderr decoration (errors, warnings) passes process.stderr explicitly.
export function bold(s: string, stream?: NodeJS.WriteStream): string {
	return paint(BOLD, s, stream);
}
export function dim(s: string, stream?: NodeJS.WriteStream): string {
	return paint(DIM, s, stream);
}
/**
 * Strikethrough. Terminals that do not implement SGR 9 simply ignore it, so
 * never let it be the only carrier of meaning — pair it with a glyph.
 */
export function strike(s: string, stream?: NodeJS.WriteStream): string {
	return paint(STRIKE, s, stream);
}
export function red(s: string, stream?: NodeJS.WriteStream): string {
	return paint(RED, s, stream);
}
export function green(s: string, stream?: NodeJS.WriteStream): string {
	return paint(GREEN, s, stream);
}
export function yellow(s: string, stream?: NodeJS.WriteStream): string {
	return paint(YELLOW, s, stream);
}
export function blue(s: string, stream?: NodeJS.WriteStream): string {
	return paint(BLUE, s, stream);
}
export function cyan(s: string, stream?: NodeJS.WriteStream): string {
	return paint(CYAN, s, stream);
}
