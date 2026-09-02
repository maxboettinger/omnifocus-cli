import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import { CLIError } from "../../src/core/errors.js";
import { readJsonArray } from "../../src/core/stdin.js";
import { withStdin } from "../helpers/env.js";

const EXAMPLE = "echo '[]' | of bulk add";

function piped(text: string) {
	return Readable.from([Buffer.from(text)]);
}

describe("readJsonArray", () => {
	test("returns the parsed array", async () => {
		const items = await withStdin(piped('[{"name":"A"}]'), () =>
			readJsonArray<{ name: string }>(EXAMPLE, "task objects"),
		);
		expect(items).toEqual([{ name: "A" }]);
	});

	test.each([
		["", "No input provided. Expected JSON array of task objects on stdin."],
		["not json", "Invalid JSON input"],
		['{"a":1}', "Input must be an array of task objects"],
		["[]", "Input array is empty"],
	])("rejects %j", async (input, message) => {
		const run = withStdin(piped(input), () => readJsonArray(EXAMPLE, "task objects"));
		await expect(run).rejects.toBeInstanceOf(CLIError);
		await expect(run).rejects.toThrow(message);
	});

	test("runs the per-item validator and reports the first failure", async () => {
		const run = withStdin(piped('[{"name":"A"},{}]'), () =>
			readJsonArray<{ name?: string }>(EXAMPLE, "task objects", (item, i) =>
				item.name ? undefined : `Task at index ${i} is missing required field 'name'`,
			),
		);
		await expect(run).rejects.toThrow("Task at index 1 is missing required field 'name'");
	});

	test("still fails fast on a TTY", async () => {
		const run = withStdin({ isTTY: true }, () => readJsonArray(EXAMPLE, "task objects"));
		await expect(run).rejects.toThrow("Example: echo '[]' | of bulk add");
	});
});
