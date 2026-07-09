import { describe, expect, test } from "bun:test";
import { parseDurationOrClear, parseDurationToSeconds } from "../../src/core/parsers.js";

describe("parseDurationToSeconds", () => {
	test("parses signed and unsigned durations", () => {
		expect(parseDurationToSeconds("30m")).toBe(1800);
		expect(parseDurationToSeconds("1h30m")).toBe(5400);
		expect(parseDurationToSeconds("90s")).toBe(90);
		expect(parseDurationToSeconds("+2h15m")).toBe(8100);
		expect(parseDurationToSeconds("-1h")).toBe(-3600);
	});

	test("accepts explicit zero durations (e.g. notification exactly at due time)", () => {
		expect(parseDurationToSeconds("0s")).toBe(0);
		expect(parseDurationToSeconds("0m")).toBe(0);
		expect(parseDurationToSeconds("0h")).toBe(0);
		expect(parseDurationToSeconds("0h0m0s")).toBe(0);
		expect(parseDurationToSeconds("-0s")).toBe(0);
	});

	test("rejects malformed durations", () => {
		expect(() => parseDurationToSeconds("")).toThrow();
		expect(() => parseDurationToSeconds("abc")).toThrow();
		expect(() => parseDurationToSeconds("1m30h")).toThrow();
		expect(() => parseDurationToSeconds("+")).toThrow();
		expect(() => parseDurationToSeconds("-")).toThrow();
		expect(() => parseDurationToSeconds("  ")).toThrow();
	});
});

describe("parseDurationOrClear", () => {
	test("supports clear", () => {
		expect(parseDurationOrClear("clear")).toBe("clear");
	});

	test("delegates to duration parser for numeric inputs", () => {
		expect(parseDurationOrClear("1h")).toBe(3600);
	});
});
