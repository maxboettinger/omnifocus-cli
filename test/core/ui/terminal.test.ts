import { describe, expect, test } from "bun:test";
import { isInteractive } from "../../../src/core/ui/terminal.js";
import { withEnv, withStreamTTY } from "../../helpers/env.js";

const PLAIN_ENV = { CI: undefined, TERM: "xterm-256color" };

describe("isInteractive", () => {
	test("true for a TTY stream in a normal terminal", () => {
		withEnv(PLAIN_ENV, () => {
			withStreamTTY(process.stderr, true, () => {
				expect(isInteractive(process.stderr)).toBe(true);
			});
		});
	});

	test("false when the stream is not a TTY", () => {
		withEnv(PLAIN_ENV, () => {
			withStreamTTY(process.stderr, false, () => {
				expect(isInteractive(process.stderr)).toBe(false);
			});
			withStreamTTY(process.stderr, undefined, () => {
				expect(isInteractive(process.stderr)).toBe(false);
			});
		});
	});

	test("false under CI, even on a TTY", () => {
		withEnv({ CI: "true", TERM: "xterm-256color" }, () => {
			withStreamTTY(process.stderr, true, () => {
				expect(isInteractive(process.stderr)).toBe(false);
			});
		});
	});

	test("false for a dumb terminal, even on a TTY", () => {
		withEnv({ CI: undefined, TERM: "dumb" }, () => {
			withStreamTTY(process.stderr, true, () => {
				expect(isInteractive(process.stderr)).toBe(false);
			});
		});
	});
});
