/**
 * Line-oriented interactive input for conversational verbs.
 *
 * `createPrompter()` asks one question at a time on a terminal and resolves
 * the trimmed answer — or `null` when the user wants out. Every way of
 * leaving is handled here, once, so a verb only has to check for `null`:
 *
 *   - Esc            a lone `\x1b` byte on stdin (see below)
 *   - Ctrl-C         readline's SIGINT event
 *   - Ctrl-D / EOF   readline's close event
 *   - /quit /q /exit typed as the answer
 *
 * Esc is detected from the raw stream rather than readline's keypress
 * parser: Bun's `emitKeypressEvents` never flushes a lone escape (it waits
 * for a following byte to decide whether it started a sequence), so a
 * standalone Esc press would only surface with the *next* key. A terminal
 * sends an arrow key or similar as one multi-byte chunk (`\x1b[A`), so a
 * one-byte `\x1b` chunk is unambiguously the Esc key.
 *
 * Entity-agnostic: knows nothing about tasks or the model. Streams are
 * injectable so tests drive it with PassThrough streams.
 */

import * as readline from "node:readline";

export interface PromptInput extends NodeJS.ReadableStream {
	isTTY?: boolean;
}

export interface PrompterStreams {
	input?: PromptInput;
	output?: NodeJS.WritableStream;
}

export interface Prompter {
	/** Ask a question; resolves the non-empty trimmed answer, or `null` to quit. */
	ask(question: string): Promise<string | null>;
	/** Ask until the first character of the answer is one of `keys` (case-insensitive). */
	choose(question: string, keys: readonly string[]): Promise<string | null>;
	close(): void;
}

export const QUIT_COMMANDS: readonly string[] = ["/quit", "/q", "/exit"];
const ESC = "\x1b";

type Outcome = { kind: "answer"; text: string } | { kind: "empty" } | { kind: "quit" };

export function createPrompter(streams: PrompterStreams = {}): Prompter {
	const input = streams.input ?? (process.stdin as PromptInput);
	const output = streams.output ?? process.stdout;
	let closed = false;

	function askOnce(question: string): Promise<Outcome> {
		return new Promise((resolve) => {
			const rl = readline.createInterface({ input, output, terminal: input.isTTY === true });
			let settled = false;
			const finish = (outcome: Outcome) => {
				if (settled) return;
				settled = true;
				input.off("data", onData);
				rl.close();
				resolve(outcome);
			};
			const onData = (chunk: Buffer | string) => {
				const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
				if (text === ESC) {
					output.write("\n");
					finish({ kind: "quit" });
				}
			};
			input.on("data", onData);
			rl.on("SIGINT", () => {
				output.write("\n");
				finish({ kind: "quit" });
			});
			rl.on("close", () => finish({ kind: "quit" }));
			rl.question(question, (answer) => {
				const text = answer.trim();
				if (!text) finish({ kind: "empty" });
				else if (QUIT_COMMANDS.includes(text.toLowerCase())) finish({ kind: "quit" });
				else finish({ kind: "answer", text });
			});
		});
	}

	async function ask(question: string): Promise<string | null> {
		while (!closed) {
			const outcome = await askOnce(question);
			if (outcome.kind === "quit") return null;
			if (outcome.kind === "answer") return outcome.text;
		}
		return null;
	}

	return {
		ask,
		async choose(question, keys) {
			const wanted = keys.map((k) => k.toLowerCase());
			while (!closed) {
				const answer = await ask(question);
				if (answer === null) return null;
				const first = answer.charAt(0).toLowerCase();
				if (wanted.includes(first)) return first;
				output.write(`Please answer with one of: ${keys.join(", ")}\n`);
			}
			return null;
		},
		close() {
			closed = true;
		},
	};
}
