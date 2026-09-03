import { afterEach, describe, expect, type mock, test } from "bun:test";
import {
	DEFAULT_PROGRESS_LABEL,
	isProgressEnabled,
	setProgressEnabled,
	withProgress,
} from "../../../src/core/ui/progress.js";
import { withSpinner } from "../../../src/core/ui/progress.js";
import { createMockClient } from "../../fixtures/mock-client.js";
import { MOCK_TASK, errorResponse, successResponse } from "../../fixtures/mock-responses.js";
import { withEnv } from "../../helpers/env.js";

const INTERACTIVE_ENV = { CI: undefined, TERM: "xterm-256color" };
const SHOW_CURSOR = "\x1b[?25h";
const HIDE_CURSOR = "\x1b[?25l";

/** Minimal stand-in for a TTY write stream, recording everything written. */
function fakeStream(isTTY = true) {
	const writes: string[] = [];
	let cleared = 0;
	return {
		isTTY,
		columns: 80,
		writes,
		get cleared() {
			return cleared;
		},
		write(chunk: unknown) {
			writes.push(String(chunk));
			return true;
		},
		cursorTo() {
			return true;
		},
		moveCursor() {
			return true;
		},
		clearLine() {
			cleared++;
			return true;
		},
	};
}

afterEach(() => {
	setProgressEnabled(false);
});

describe("progress enablement", () => {
	test("is off by default and toggles", () => {
		expect(isProgressEnabled()).toBe(false);
		setProgressEnabled(true);
		expect(isProgressEnabled()).toBe(true);
	});
});

describe("withProgress", () => {
	test("forwards arguments and returns the inner result", async () => {
		const inner = createMockClient();
		const client = withProgress(inner, { stream: fakeStream() });

		const result = await client.forecast({ days: 5, includeFlagged: true });

		expect(inner.forecast).toHaveBeenCalledWith({ days: 5, includeFlagged: true });
		expect(result).toEqual(
			await (inner.forecast as ReturnType<typeof mock>).mock.results[0]?.value,
		);
	});

	test("propagates rejections unchanged", async () => {
		const inner = createMockClient();
		const boom = new Error("osascript exploded");
		(inner.stats as ReturnType<typeof mock>).mockImplementation(() => Promise.reject(boom));
		const client = withProgress(inner, { stream: fakeStream() });

		await expect(client.stats()).rejects.toBe(boom);
	});

	test("writes nothing when progress is disabled, even on an interactive stream", async () => {
		const stream = fakeStream();
		const client = withProgress(createMockClient(), { stream });

		await withEnv(INTERACTIVE_ENV, () => client.forecast({}));

		expect(stream.writes).toEqual([]);
	});

	test("writes nothing when the stream is not interactive", async () => {
		setProgressEnabled(true);
		const stream = fakeStream(false);
		const client = withProgress(createMockClient(), { stream });

		await withEnv(INTERACTIVE_ENV, () => client.forecast({}));

		expect(stream.writes).toEqual([]);
	});

	test("writes nothing under CI", async () => {
		setProgressEnabled(true);
		const stream = fakeStream();
		const client = withProgress(createMockClient(), { stream });

		await withEnv({ CI: "1", TERM: "xterm-256color" }, () => client.forecast({}));

		expect(stream.writes).toEqual([]);
	});

	test("renders an op-specific label and clears itself when enabled and interactive", async () => {
		setProgressEnabled(true);
		const stream = fakeStream();
		const inner = createMockClient();
		// Hold the op open long enough for the spinner to paint at least one frame.
		(inner.forecast as ReturnType<typeof mock>).mockImplementation(
			() => new Promise((resolve) => setTimeout(() => resolve(successResponse({})), 20)),
		);
		const client = withProgress(inner, { stream });

		await withEnv(INTERACTIVE_ENV, () => client.forecast({}));

		const output = stream.writes.join("");
		expect(output).toContain("Building forecast");
		expect(output).toContain(HIDE_CURSOR);
		expect(output.endsWith(SHOW_CURSOR)).toBe(true);
		expect(stream.cleared).toBeGreaterThan(0);
	});

	test("falls back to the default label for ops without one", async () => {
		setProgressEnabled(true);
		const stream = fakeStream();
		const client = withProgress(createMockClient(), { stream });

		await withEnv(INTERACTIVE_ENV, () => client.getTask("milk"));

		expect(stream.writes.join("")).toContain(DEFAULT_PROGRESS_LABEL);
	});

	test("honors caller-provided labels", async () => {
		setProgressEnabled(true);
		const stream = fakeStream();
		const client = withProgress(createMockClient(), {
			stream,
			labels: { getTask: "Finding that task…" },
		});

		await withEnv(INTERACTIVE_ENV, () => client.getTask("milk"));

		expect(stream.writes.join("")).toContain("Finding that task…");
	});

	test("restores the cursor when the op rejects", async () => {
		setProgressEnabled(true);
		const stream = fakeStream();
		const inner = createMockClient();
		(inner.stats as ReturnType<typeof mock>).mockImplementation(() =>
			Promise.reject(new Error("nope")),
		);
		const client = withProgress(inner, { stream });

		await expect(withEnv(INTERACTIVE_ENV, () => client.stats())).rejects.toThrow("nope");

		expect(stream.writes.join("").endsWith(SHOW_CURSOR)).toBe(true);
	});

	test("an { ok: false } bridge response is not an exception and is returned as-is", async () => {
		setProgressEnabled(true);
		const stream = fakeStream();
		const inner = createMockClient();
		const failure = errorResponse("Task not found", [MOCK_TASK.name]);
		(inner.getTask as ReturnType<typeof mock>).mockImplementation(() => Promise.resolve(failure));
		const client = withProgress(inner, { stream });

		const result = await withEnv(INTERACTIVE_ENV, () => client.getTask("x"));

		expect(result).toBe(failure);
		expect(stream.writes.join("").endsWith(SHOW_CURSOR)).toBe(true);
	});
});

describe("withSpinner", () => {
	test("returns the function's result without drawing when disabled", async () => {
		const stream = fakeStream();
		const result = await withEnv(INTERACTIVE_ENV, () =>
			withSpinner("Thinking…", async () => 42, stream as never),
		);
		expect(result).toBe(42);
		expect(stream.writes).toEqual([]);
	});

	test("draws the label while the function runs and clears it afterwards", async () => {
		setProgressEnabled(true);
		const stream = fakeStream();
		const result = await withEnv(INTERACTIVE_ENV, () =>
			withSpinner(
				"Thinking…",
				() => new Promise<string>((resolve) => setTimeout(() => resolve("done"), 20)),
				stream as never,
			),
		);
		expect(result).toBe("done");
		expect(stream.writes.join("")).toContain("Thinking…");
		expect(stream.writes.join("")).toContain(SHOW_CURSOR);
	});

	test("stays silent on a non-interactive stream and still propagates rejections", async () => {
		setProgressEnabled(true);
		const stream = fakeStream(false);
		await expect(
			withEnv(INTERACTIVE_ENV, () =>
				withSpinner("Thinking…", () => Promise.reject(new Error("boom")), stream as never),
			),
		).rejects.toThrow("boom");
		expect(stream.writes).toEqual([]);
	});
});
