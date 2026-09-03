/**
 * Program assembly — builds the Commander program with all command groups.
 *
 * Kept separate from the executable entry point (index.ts) so tests can
 * construct the full program without triggering argv parsing.
 */

import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import { registerBulkCommands } from "./commands/bulk/index.js";
import { registerCollectCommand } from "./commands/collect.js";
import { registerCompletionCommand } from "./commands/completion.js";
import { registerFolderCommands } from "./commands/folder/index.js";
import { registerForecastCommand } from "./commands/forecast.js";
import { registerInboxCommands } from "./commands/inbox/index.js";
import { registerProjectCommands } from "./commands/project/index.js";
import { registerReviewCommand } from "./commands/review.js";
import { registerStatsCommand } from "./commands/stats.js";
import { registerTagCommands } from "./commands/tag/index.js";
import { registerTaskCommands } from "./commands/task/index.js";
import { createAIClient } from "./core/ai/client.js";
import type { AIClient } from "./core/ai/types.js";
import { resolveFormat } from "./core/output.js";
import type { OmniFocusClient } from "./core/types.js";
import { setProgressEnabled } from "./core/ui/progress.js";

/**
 * @param client - the OmniFocus seam (real or mock)
 * @param ai - the model seam; defaults to the lazy OpenRouter client, which
 *   costs nothing until a verb calls it. Tests pass a scripted fake.
 */
export function buildProgram(client: OmniFocusClient, ai: AIClient = createAIClient()): Command {
	const program = new Command();

	program
		.name("of")
		.description("Professional CLI for OmniFocus task management")
		.version(pkg.version)
		.option("--json", "Output in JSON format");

	// Progress chrome (spinners on stderr) is opt-in per invocation: it is
	// allowed only when the resolved output format is human. JSON runs —
	// explicit --json, piped stdout, agent harnesses — never see it.
	program.hook("preAction", (_thisCommand, actionCommand) => {
		const json = actionCommand.optsWithGlobals().json as boolean | undefined;
		setProgressEnabled(resolveFormat(json) === "human");
	});

	registerTaskCommands(program, client, ai);
	registerProjectCommands(program, client, ai);
	registerTagCommands(program, client, ai);
	registerFolderCommands(program, client, ai);
	registerInboxCommands(program, client, ai);
	registerBulkCommands(program, client, ai);
	registerForecastCommand(program, client);
	registerReviewCommand(program, client);
	registerStatsCommand(program, client);
	registerCollectCommand(program, client);
	registerCompletionCommand(program);

	return program;
}
