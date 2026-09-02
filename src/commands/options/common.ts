/**
 * Option groups shared across nouns. Each `xxxOption(s)` declares flags on a
 * Commander command and returns it; each `readXxx` maps the parsed opts to
 * client parameters so verbs never repeat the flag → param mapping.
 */

import type { Command } from "commander";
import { ConfirmationRequiredError } from "../../core/errors.js";
import { parseIntOption } from "../../core/parsers.js";

export function confirmOption(
	cmd: Command,
	help = "Confirm the destructive action, required for safety",
): Command {
	return cmd.option("--confirm", help);
}

/** Throw the standard confirmation error unless `--confirm` was passed. */
export function requireConfirm(opts: Record<string, unknown>, action: string): void {
	if (!opts.confirm) throw new ConfirmationRequiredError(action);
}

export function limitOption(cmd: Command, defaultLimit?: number): Command {
	const help = "Maximum number of results";
	return defaultLimit === undefined
		? cmd.option("--limit <n>", help, parseIntOption)
		: cmd.option("--limit <n>", help, parseIntOption, defaultLimit);
}

export interface ListQueryLabels {
	/** Help text for `--count`, e.g. "Include task counts". */
	count: string;
	/** Help text for `--active-only`; the flag is omitted when undefined. */
	activeOnly?: string;
}

export function listQueryOptions(cmd: Command, labels: ListQueryLabels): Command {
	cmd.option("--search <query>", "Filter by name").option("--count", labels.count);
	if (labels.activeOnly) cmd.option("--active-only", labels.activeOnly);
	return limitOption(cmd);
}

export interface ListQuery {
	search?: string;
	count?: boolean;
	activeOnly?: boolean;
	limit?: number;
}

export function readListQuery(opts: Record<string, unknown>): ListQuery {
	return {
		search: opts.search as string | undefined,
		count: opts.count as boolean | undefined,
		activeOnly: opts.activeOnly as boolean | undefined,
		limit: opts.limit as number | undefined,
	};
}
