import { describe, expect, test } from "bun:test";
import { bold, colorEnabled, dim, paint, red } from "../../../src/core/ui/colors.js";
import { withEnv, withStreamTTY } from "../../helpers/env.js";

const NO_ENV = { NO_COLOR: undefined, FORCE_COLOR: undefined };

describe("colorEnabled", () => {
	test("is off when NO_COLOR is set, even on a TTY", () => {
		withEnv({ NO_COLOR: "1", FORCE_COLOR: undefined }, () => {
			withStreamTTY(process.stdout, true, () => {
				expect(colorEnabled(process.stdout)).toBe(false);
			});
		});
	});

	test("is on when FORCE_COLOR is set, even when piped", () => {
		withEnv({ NO_COLOR: undefined, FORCE_COLOR: "1" }, () => {
			withStreamTTY(process.stdout, false, () => {
				expect(colorEnabled(process.stdout)).toBe(true);
			});
		});
	});

	test("FORCE_COLOR=0 does not force color on", () => {
		withEnv({ NO_COLOR: undefined, FORCE_COLOR: "0" }, () => {
			withStreamTTY(process.stdout, false, () => {
				expect(colorEnabled(process.stdout)).toBe(false);
			});
		});
	});

	test("otherwise follows the stream's own TTY state", () => {
		withEnv(NO_ENV, () => {
			withStreamTTY(process.stderr, true, () => {
				expect(colorEnabled(process.stderr)).toBe(true);
			});
			withStreamTTY(process.stderr, false, () => {
				expect(colorEnabled(process.stderr)).toBe(false);
			});
		});
	});
});

describe("paint and named colors", () => {
	test("wrap text in ANSI codes when color is forced on", () => {
		withEnv({ NO_COLOR: undefined, FORCE_COLOR: "1" }, () => {
			expect(red("x")).toBe("\x1b[31mx\x1b[0m");
			expect(bold("x")).toBe("\x1b[1mx\x1b[0m");
			expect(dim("x")).toBe("\x1b[2mx\x1b[0m");
		});
	});

	test("return plain text when color is disabled", () => {
		withEnv({ NO_COLOR: "1", FORCE_COLOR: undefined }, () => {
			expect(red("x")).toBe("x");
			expect(paint("\x1b[36m", "x", process.stderr)).toBe("x");
		});
	});

	test("stdout helpers follow stdout's TTY state by default", () => {
		withEnv(NO_ENV, () => {
			const colored = withStreamTTY(process.stdout, true, () => red("x"));
			expect(colored).toContain("\x1b[31m");
			const plain = withStreamTTY(process.stdout, undefined, () => red("x"));
			expect(plain).toBe("x");
		});
	});

	test("an explicit stream argument targets that stream's TTY state", () => {
		withEnv(NO_ENV, () => {
			withStreamTTY(process.stdout, false, () =>
				withStreamTTY(process.stderr, true, () => {
					expect(red("x", process.stderr)).toBe("\x1b[31mx\x1b[0m");
					expect(red("x", process.stdout)).toBe("x");
					expect(paint("\x1b[31m", "x", process.stderr)).toBe("\x1b[31mx\x1b[0m");
				}),
			);
		});
	});
});
