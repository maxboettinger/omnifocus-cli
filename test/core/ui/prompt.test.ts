import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { QUIT_COMMANDS, createPrompter } from "../../../src/core/ui/prompt.js";

function streams() {
	const input = new PassThrough();
	const output = new PassThrough();
	const written: string[] = [];
	output.on("data", (chunk) => written.push(String(chunk)));
	return { input, output, written };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("createPrompter().ask", () => {
	test("resolves the trimmed answer line", async () => {
		const { input, output } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.ask("> ");
		input.write("  hello world \n");
		expect(await pending).toBe("hello world");
	});

	test("re-asks on an empty line until something is typed", async () => {
		const { input, output, written } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.ask("> ");
		input.write("\n");
		await tick();
		input.write("   \n");
		await tick();
		input.write("second try\n");
		expect(await pending).toBe("second try");
		expect(written.filter((w) => w === "> ").length).toBeGreaterThanOrEqual(3);
	});

	test("every quit command resolves null", async () => {
		for (const command of QUIT_COMMANDS) {
			const { input, output } = streams();
			const prompter = createPrompter({ input, output });
			const pending = prompter.ask("> ");
			input.write(`${command.toUpperCase()}\n`);
			expect(await pending).toBeNull();
		}
	});

	test("a lone Esc byte resolves null immediately", async () => {
		const { input, output } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.ask("> ");
		input.write("\x1b");
		expect(await pending).toBeNull();
	});

	test("an escape sequence such as an arrow key is not treated as Esc", async () => {
		const { input, output } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.ask("> ");
		input.write("\x1b[A");
		await tick();
		input.write("still here\n");
		expect(await pending).toBe("\x1b[Astill here");
	});

	test("EOF (Ctrl-D) resolves null", async () => {
		const { input, output } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.ask("> ");
		input.end();
		expect(await pending).toBeNull();
	});

	test("a closed prompter resolves null without reading", async () => {
		const { input, output } = streams();
		const prompter = createPrompter({ input, output });
		prompter.close();
		expect(await prompter.ask("> ")).toBeNull();
	});
});

describe("createPrompter().choose", () => {
	test("accepts the first character of a matching answer, case-insensitively", async () => {
		const { input, output } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.choose("[a/r/q] ", ["a", "r", "q"]);
		input.write("Revise please\n");
		expect(await pending).toBe("r");
	});

	test("re-asks with a hint on an invalid answer", async () => {
		const { input, output, written } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.choose("[a/r/q] ", ["a", "r", "q"]);
		input.write("x\n");
		await tick();
		input.write("a\n");
		expect(await pending).toBe("a");
		expect(written.join("")).toContain("Please answer with one of: a, r, q");
	});

	test("quitting propagates as null", async () => {
		const { input, output } = streams();
		const prompter = createPrompter({ input, output });
		const pending = prompter.choose("[a/r/q] ", ["a", "r", "q"]);
		input.write("/q\n");
		expect(await pending).toBeNull();
	});
});
