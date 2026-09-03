import type { Command } from "commander";
import { renderTaskContext, todayString } from "../../core/ai/context.js";
import { Conversation } from "../../core/ai/conversation.js";
import { loadPrompt } from "../../core/ai/prompts.js";
import { type AIClient, AIError, type ChatResult } from "../../core/ai/types.js";
import { unwrapBridgeResponse } from "../../core/client.js";
import { CLIError } from "../../core/errors.js";
import type { OmniFocusClient } from "../../core/types.js";
import { bold, cyan, dim } from "../../core/ui/colors.js";
import { createPrompter } from "../../core/ui/prompt.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

const TEMPERATURE = 0.7;

/**
 * Stream one assistant turn to stdout. Ctrl-C while the model is talking
 * aborts the request and ends the session (resolves null) instead of
 * killing the process mid-line.
 */
async function speak(
	ai: AIClient,
	convo: Conversation,
	model: string | undefined,
): Promise<ChatResult | null> {
	const controller = new AbortController();
	const onSigint = () => controller.abort();
	process.once("SIGINT", onSigint);
	process.stdout.write(cyan("◆ "));
	try {
		const result = await ai.stream(
			{ messages: convo.messages, model, temperature: TEMPERATURE, signal: controller.signal },
			(delta) => {
				process.stdout.write(delta);
			},
		);
		process.stdout.write("\n\n");
		return result;
	} catch (error) {
		if (error instanceof AIError && error.kind === "aborted") {
			process.stdout.write("\n");
			return null;
		}
		throw error;
	} finally {
		process.off("SIGINT", onSigint);
	}
}

/**
 * `of task why [ref]` — an interactive "five whys" session about a task
 * the user is avoiding (or about anything, without a ref). Every turn
 * sends the whole history; the session ends only when the user quits
 * (Esc, Ctrl-C, Ctrl-D or /quit).
 */
export function registerWhyCommand(parent: Command, client: OmniFocusClient, ai: AIClient): void {
	const cmd = parent
		.command("why")
		.description("Interactive five-whys session about a task you are avoiding");
	taskRefArgument(cmd);
	cmd
		.option("--context <text>", "Extra context for the coach")
		.option("--model <id>", "Model id, overrides $OF_AI_MODEL and the config file")
		.action(
			runAction(async (ctx, ref: string | undefined) => {
				if (
					ctx.format === "json" ||
					process.stdin.isTTY !== true ||
					process.stdout.isTTY !== true
				) {
					throw new CLIError(
						"task why is an interactive session; run it in a terminal, without --json",
					);
				}
				const resolved = readTaskRef(ref, ctx.opts);
				const extra = ctx.opts.context as string | undefined;
				const model = ctx.opts.model as string | undefined;
				const today = todayString();

				let opening: string;
				if (resolved.query || resolved.id) {
					const context = unwrapBridgeResponse(
						await client.getTaskContext(
							resolved.id ? { id: resolved.id } : { query: resolved.query as string },
						),
					);
					opening = `${renderTaskContext(context, { today, extra })}\n\nStart the session with your first question about this task.`;
					console.log(bold(`Why: ${context.task.name}`));
				} else {
					opening = [
						`## Today\n${today}`,
						"No specific task was given.",
						extra?.trim() ? `The person says: ${extra.trim()}` : "",
						"Start by asking what they are avoiding right now.",
					]
						.filter(Boolean)
						.join("\n\n");
					console.log(bold("Why"));
				}
				console.log(dim("Answer each question. Esc, Ctrl-C or /quit ends the session.\n"));

				const convo = new Conversation(loadPrompt("why").text).user(opening);
				const prompter = createPrompter({ output: process.stderr });
				try {
					for (;;) {
						const turn = await speak(ai, convo, model);
						if (turn === null) break;
						convo.assistant(turn.content);
						const answer = await prompter.ask("> ");
						if (answer === null) break;
						convo.user(answer);
					}
				} finally {
					prompter.close();
				}
				console.log(dim("\nSession ended."));
			}),
		);
}
