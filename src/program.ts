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
import { resolveFormat } from "./core/output.js";
import type { OmniFocusClient } from "./core/types.js";
import { setProgressEnabled } from "./core/ui/progress.js";

export function buildProgram(client: OmniFocusClient): Command {
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

	registerTaskCommands(program, client);
	registerProjectCommands(program, client);
	registerTagCommands(program, client);
	registerFolderCommands(program, client);
	registerInboxCommands(program, client);
	registerBulkCommands(program, client);
	registerForecastCommand(program, client);
	registerReviewCommand(program, client);
	registerStatsCommand(program, client);
	registerCollectCommand(program, client);
	registerCompletionCommand(program);

	return program;
}
