import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError } from "../../core/errors.js";
import {
	formatProjectDetail,
	outputJson,
	outputSuccess,
	resolveFormat,
} from "../../core/output.js";
import { outputError } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create a project")
		.argument("<name>", "Project name")
		.option("--folder <name>", "Parent folder")
		.option("--status <status>", "Project status")
		.option("--sequential", "Make project sequential")
		.option("--note <text>", "Project note")
		.option("--flag", "Flag the project")
		.option("--json", "JSON output")
		.action(async (name: string, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const createOptions = {
					name,
					folder: opts.folder as string,
					status: opts.status as string,
					sequential: opts.sequential as boolean,
					note: opts.note as string,
					flag: opts.flag as boolean,
				};

				const response = await client.createProject(createOptions);
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputSuccess(`Created project: ${data.project.name}`);
				console.log(formatProjectDetail(data.project));
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
