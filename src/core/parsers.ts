/**
 * Shared Commander option parsers.
 *
 * Commander passes (value: string, previous: T) to custom parsers.
 * Bare `Number.parseInt` interprets `previous` as the radix — always
 * use these wrappers instead.
 */

/** Parse an integer from a Commander option value. Returns NaN-safe result. */
export function parseIntOption(value: string): number {
	const n = Number.parseInt(value, 10);
	if (Number.isNaN(n)) {
		throw new Error(`Invalid number: ${value}`);
	}
	return n;
}

/**
 * Parse duration strings like -1h, 30m, 1h30m, 90s, +2h15m into seconds.
 */
export function parseDurationToSeconds(value: string): number {
	const trimmed = value.trim();
	const match = /^([+-])?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(trimmed);
	// The regex also matches strings with no components at all ("", "+", "-"),
	// so require at least one explicit h/m/s part. Explicit zeros ("0s") are
	// valid: a due-relative offset of 0 means "exactly at the due time".
	if (!match || (match[2] === undefined && match[3] === undefined && match[4] === undefined)) {
		throw new Error(`Invalid duration: ${value}`);
	}

	const hours = match[2] ? Number.parseInt(match[2], 10) : 0;
	const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
	const seconds = match[4] ? Number.parseInt(match[4], 10) : 0;

	const total = hours * 3600 + minutes * 60 + seconds;
	if (total === 0) return 0; // avoid -0 from "-0s"
	return match[1] === "-" ? -total : total;
}

export function parseDurationOrClear(value: string): number | "clear" {
	if (value === "clear") return "clear";
	return parseDurationToSeconds(value);
}

/** Commander repeatable-option accumulator: `--tag a --tag b` → ["a", "b"]. */
export function collectRepeatable(value: string, previous: string[]): string[] {
	return [...previous, value];
}

/** Integer option that also accepts the literal `clear` (used to remove a value). */
export function parseIntOrClear(value: string): number | "clear" {
	if (value === "clear") return "clear";
	return parseIntOption(value);
}
