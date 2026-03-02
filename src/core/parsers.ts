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
