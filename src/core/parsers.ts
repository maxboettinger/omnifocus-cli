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
	if (!match) {
		throw new Error(`Invalid duration: ${value}`);
	}

	const hours = match[2] ? Number.parseInt(match[2], 10) : 0;
	const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
	const seconds = match[4] ? Number.parseInt(match[4], 10) : 0;

	if (hours === 0 && minutes === 0 && seconds === 0) {
		throw new Error(`Invalid duration: ${value}`);
	}

	const total = hours * 3600 + minutes * 60 + seconds;
	return match[1] === "-" ? -total : total;
}

export function parseDurationOrClear(value: string): number | "clear" {
	if (value === "clear") return "clear";
	return parseDurationToSeconds(value);
}
