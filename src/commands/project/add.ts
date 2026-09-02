import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { formatProjectDetail, outputJson, outputSuccess } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";

export function registerAddCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("add")
		.description("Create a project")
		.argument("<name>", "Project name")
		.option("--folder <folder>", "Parent folder")
		.option("--status <status>", "Project status")
		.option("--sequential", "Make the project sequential")
		.option("--note <text>", "Project note")
		.option("--flag", "Flag the project")
		.action(
			runAction(async (ctx, name: string) => {
				const data = unwrapBridgeResponse(
					await client.createProject({
						name,
						folder: ctx.opts.folder as string | undefined,
						status: ctx.opts.status as string | undefined,
						sequential: ctx.opts.sequential as boolean | undefined,
						note: ctx.opts.note as string | undefined,
						flag: ctx.opts.flag as boolean | undefined,
					}),
				);
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputSuccess(`Created project: ${data.project.name}`);
				console.log(formatProjectDetail(data.project));
			}),
		);
}
