/**
 * Short numeric aliases for OmniFocus task IDs.
 *
 * Human-mode listings prefix each task with a small number (`42`) that maps
 * to the task's persistent 11-char OmniFocus ID (`eQxJnR5YSeK`). The map is
 * cached on disk between invocations so `of task complete 42` works after
 * `of task list`. Two invariants keep stale references safe:
 *
 * - An alias, once assigned, always refers to the same task.
 * - Alias numbers are never reused (monotonic counter), so a pruned alias
 *   resolves to "not found" rather than to a different task.
 *
 * Every filesystem failure degrades gracefully: listings still render
 * (with freshly computed numbers) and lookups simply miss. JSON output
 * never touches this module — scripts keep using real OmniFocus IDs.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface ShortIdOptions {
	/** Cache file location; defaults to shortIdCachePath(). */
	cachePath?: string;
	/** Entry cap before oldest aliases are pruned. */
	maxEntries?: number;
}

/** Resolved task reference: pass `id` (when set) through existing --id plumbing. */
export interface TaskRef {
	query?: string;
	id?: string;
}

interface ShortIdCache {
	version: 1;
	counter: number;
	/** OmniFocus id → alias number. */
	aliases: Record<string, number>;
}

const DEFAULT_MAX_ENTRIES = 10_000;

/** `$OF_SHORT_ID_CACHE` (test seam) or `$XDG_CACHE_HOME`/`~/.cache`. */
export function shortIdCachePath(): string {
	const override = process.env.OF_SHORT_ID_CACHE;
	if (override) return override;
	const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
	return join(cacheHome, "omnifocus-cli", "short-ids.json");
}

function loadCache(cachePath: string): ShortIdCache {
	const empty: ShortIdCache = { version: 1, counter: 0, aliases: {} };
	try {
		const parsed = JSON.parse(readFileSync(cachePath, "utf8"));
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			parsed.version !== 1 ||
			typeof parsed.counter !== "number" ||
			typeof parsed.aliases !== "object" ||
			parsed.aliases === null
		) {
			return empty;
		}
		// Trust nothing about the entries themselves: a hand-edited or
		// truncated cache must not be able to hand out a bad alias.
		const aliases: Record<string, number> = {};
		let highest = 0;
		for (const [ofId, alias] of Object.entries(parsed.aliases)) {
			if (typeof alias !== "number" || !Number.isInteger(alias) || alias < 1) continue;
			aliases[ofId] = alias;
			if (alias > highest) highest = alias;
		}
		// A counter lagging its own aliases would re-mint a number that is
		// still in use, breaking the "never reused" invariant.
		const counter = Math.max(Math.trunc(parsed.counter), highest, 0);
		return { version: 1, counter, aliases };
	} catch {
		return empty;
	}
}

function saveCache(cachePath: string, cache: ShortIdCache): void {
	try {
		mkdirSync(dirname(cachePath), { recursive: true });
		// Write-then-rename (same directory, so rename stays atomic) so a
		// crash never leaves a half-written cache.
		const tmpPath = `${cachePath}.${process.pid}.tmp`;
		writeFileSync(tmpPath, JSON.stringify(cache));
		renameSync(tmpPath, cachePath);
	} catch {
		// Cache persistence is best-effort; rendering must never fail on it.
	}
}

/** Drop lowest-numbered aliases (the oldest) not in `keep` until under the cap. */
function prune(cache: ShortIdCache, maxEntries: number, keep: Set<string>): void {
	const excess = Object.keys(cache.aliases).length - maxEntries;
	if (excess <= 0) return;
	const prunable = Object.entries(cache.aliases)
		.filter(([ofId]) => !keep.has(ofId))
		.sort(([, a], [, b]) => a - b);
	for (const [ofId] of prunable.slice(0, excess)) {
		delete cache.aliases[ofId];
	}
}

/**
 * Ensure every OmniFocus id has an alias, persist new assignments, and
 * return the id → alias map for the given ids.
 */
export function assignShortIds(ofIds: string[], opts: ShortIdOptions = {}): Map<string, number> {
	const cachePath = opts.cachePath ?? shortIdCachePath();
	const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
	const cache = loadCache(cachePath);

	let changed = false;
	const result = new Map<string, number>();
	for (const ofId of ofIds) {
		let alias = cache.aliases[ofId];
		if (alias === undefined) {
			cache.counter += 1;
			alias = cache.counter;
			cache.aliases[ofId] = alias;
			changed = true;
		}
		result.set(ofId, alias);
	}

	if (changed) {
		prune(cache, maxEntries, new Set(ofIds));
		saveCache(cachePath, cache);
	}
	return result;
}

/** Look up an existing alias for an OmniFocus id without minting a new one. */
export function peekShortId(ofId: string, opts: ShortIdOptions = {}): number | undefined {
	const cache = loadCache(opts.cachePath ?? shortIdCachePath());
	return cache.aliases[ofId];
}

/** Reverse-map an alias number to its OmniFocus id, if still cached. */
export function lookupShortId(alias: number, opts: ShortIdOptions = {}): string | undefined {
	const cache = loadCache(opts.cachePath ?? shortIdCachePath());
	for (const [ofId, n] of Object.entries(cache.aliases)) {
		if (n === alias) return ofId;
	}
	return undefined;
}

/** An all-digit value with a cached alias → its OmniFocus id, else undefined. */
function aliasToOfId(value: string, opts: ShortIdOptions): string | undefined {
	if (!/^\d+$/.test(value)) return undefined;
	return lookupShortId(Number.parseInt(value, 10), opts);
}

/**
 * Turn a positional task reference into `{ query, id }`. An explicit --id
 * wins; otherwise an all-digit ref matching a cached alias resolves to that
 * task's OmniFocus id; anything else stays a fuzzy name query.
 */
export function resolveTaskRef(
	ref: string | undefined,
	explicitId?: string,
	opts: ShortIdOptions = {},
): TaskRef {
	if (explicitId) return { query: ref, id: explicitId };
	if (ref) {
		const ofId = aliasToOfId(ref, opts);
		if (ofId) return { query: ref, id: ofId };
	}
	return { query: ref };
}

/**
 * Normalise an id the user typed into an OmniFocus id: a short alias becomes
 * the task's real id, anything else (including a number with no cached alias)
 * is already one and passes through, so the bridge reports it as not found.
 * Unlike `resolveTaskRef` there is no name-query fallback — the caller has
 * said this is an id — and no alias is ever minted.
 */
export function resolveTaskId(id: string, opts: ShortIdOptions = {}): string {
	return aliasToOfId(id, opts) ?? id;
}
