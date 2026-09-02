import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assignShortIds,
	lookupShortId,
	peekShortId,
	resolveTaskRef,
} from "../../src/core/short-ids.js";

// ── Test fixtures ───────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeCachePath(): string {
	const dir = mkdtempSync(join(tmpdir(), "of-short-ids-"));
	tempDirs.push(dir);
	return join(dir, "short-ids.json");
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

// ── assignShortIds ──────────────────────────────────────────────────────────

describe("assignShortIds", () => {
	test("assigns sequential aliases starting at 1", () => {
		const cachePath = makeCachePath();
		const aliases = assignShortIds(["ofIdAAAAAAA", "ofIdBBBBBBB"], { cachePath });
		expect(aliases.get("ofIdAAAAAAA")).toBe(1);
		expect(aliases.get("ofIdBBBBBBB")).toBe(2);
	});

	test("a task keeps its alias across calls", () => {
		const cachePath = makeCachePath();
		const first = assignShortIds(["ofIdAAAAAAA"], { cachePath });
		const second = assignShortIds(["ofIdBBBBBBB", "ofIdAAAAAAA"], { cachePath });
		expect(second.get("ofIdAAAAAAA")).toBe(first.get("ofIdAAAAAAA"));
		expect(second.get("ofIdBBBBBBB")).toBe(2);
	});

	test("persists assignments to the cache file", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(existsSync(cachePath)).toBe(true);
		const stored = JSON.parse(readFileSync(cachePath, "utf8"));
		expect(stored.aliases.ofIdAAAAAAA).toBe(1);
	});

	test("creates missing parent directories", () => {
		const cachePath = join(makeCachePath(), "..", "nested", "deeper", "short-ids.json");
		const aliases = assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(aliases.get("ofIdAAAAAAA")).toBe(1);
		expect(existsSync(cachePath)).toBe(true);
	});

	test("recovers from a corrupt cache file without throwing", () => {
		const cachePath = makeCachePath();
		writeFileSync(cachePath, "not json{{{");
		const aliases = assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(aliases.get("ofIdAAAAAAA")).toBe(1);
	});

	test("never re-mints an in-use number when the stored counter lags the aliases", () => {
		const cachePath = makeCachePath();
		writeFileSync(
			cachePath,
			JSON.stringify({ version: 1, counter: 1, aliases: { "old-a": 1, "old-b": 5 } }),
		);
		const aliases = assignShortIds(["new-c"], { cachePath });
		expect(aliases.get("new-c")).toBe(6);
	});

	test("drops non-integer alias entries from a tampered cache", () => {
		const cachePath = makeCachePath();
		writeFileSync(
			cachePath,
			JSON.stringify({ version: 1, counter: 3, aliases: { "old-a": 1, bad: "nope" } }),
		);
		expect(peekShortId("bad", { cachePath })).toBeUndefined();
		expect(peekShortId("old-a", { cachePath })).toBe(1);
	});

	test("still returns aliases when the cache file is unwritable", () => {
		// A directory at the cache path makes both read and write fail.
		const dir = mkdtempSync(join(tmpdir(), "of-short-ids-"));
		tempDirs.push(dir);
		const aliases = assignShortIds(["ofIdAAAAAAA"], { cachePath: dir });
		expect(aliases.get("ofIdAAAAAAA")).toBe(1);
	});

	test("prunes oldest entries beyond maxEntries without reusing numbers", () => {
		const cachePath = makeCachePath();
		assignShortIds(["old-1", "old-2", "old-3"], { cachePath, maxEntries: 3 });
		const aliases = assignShortIds(["new-4", "new-5"], { cachePath, maxEntries: 3 });
		// Counter keeps growing: pruned slots are never handed to other tasks.
		expect(aliases.get("new-4")).toBe(4);
		expect(aliases.get("new-5")).toBe(5);
		// Oldest entries were dropped to stay within the cap.
		expect(lookupShortId(1, { cachePath })).toBeUndefined();
		expect(lookupShortId(5, { cachePath })).toBe("new-5");
	});

	test("keeps currently listed tasks even when pruning", () => {
		const cachePath = makeCachePath();
		assignShortIds(["old-1", "old-2"], { cachePath, maxEntries: 2 });
		const aliases = assignShortIds(["old-1", "new-3"], { cachePath, maxEntries: 2 });
		expect(aliases.get("old-1")).toBe(1);
		expect(lookupShortId(1, { cachePath })).toBe("old-1");
		expect(lookupShortId(3, { cachePath })).toBe("new-3");
	});
});

// ── lookupShortId ───────────────────────────────────────────────────────────

describe("lookupShortId", () => {
	test("returns the OmniFocus id for a known alias", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(lookupShortId(1, { cachePath })).toBe("ofIdAAAAAAA");
	});

	test("returns undefined for an unknown alias", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(lookupShortId(99, { cachePath })).toBeUndefined();
	});

	test("returns undefined when no cache file exists", () => {
		const cachePath = makeCachePath();
		expect(lookupShortId(1, { cachePath })).toBeUndefined();
	});
});

// ── peekShortId ─────────────────────────────────────────────────────────────

describe("peekShortId", () => {
	test("returns an existing alias without minting a new one", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(peekShortId("ofIdAAAAAAA", { cachePath })).toBe(1);
	});

	test("returns undefined for an unknown id and leaves the cache untouched", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(peekShortId("ofIdBBBBBBB", { cachePath })).toBeUndefined();
		// Nothing was minted for the unknown id.
		expect(assignShortIds(["ofIdCCCCCCC"], { cachePath }).get("ofIdCCCCCCC")).toBe(2);
	});
});

// ── resolveTaskRef ──────────────────────────────────────────────────────────

describe("resolveTaskRef", () => {
	test("maps an all-digit ref with a known alias to the OmniFocus id", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(resolveTaskRef("1", undefined, { cachePath })).toEqual({
			query: "1",
			id: "ofIdAAAAAAA",
		});
	});

	test("leaves an all-digit ref with no cached alias as a query", () => {
		const cachePath = makeCachePath();
		expect(resolveTaskRef("42", undefined, { cachePath })).toEqual({ query: "42" });
	});

	test("leaves a non-numeric ref as a query", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(resolveTaskRef("Buy milk", undefined, { cachePath })).toEqual({ query: "Buy milk" });
	});

	test("an explicit --id always wins over alias lookup", () => {
		const cachePath = makeCachePath();
		assignShortIds(["ofIdAAAAAAA"], { cachePath });
		expect(resolveTaskRef("1", "explicit-id", { cachePath })).toEqual({
			query: "1",
			id: "explicit-id",
		});
	});

	test("handles an undefined ref (query omitted, --id only)", () => {
		const cachePath = makeCachePath();
		expect(resolveTaskRef(undefined, "explicit-id", { cachePath })).toEqual({
			query: undefined,
			id: "explicit-id",
		});
	});
});
