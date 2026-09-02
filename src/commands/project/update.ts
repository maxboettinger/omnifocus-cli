import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputChanges, outputJson } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { projectRefArgument } from "../options/refs.js";

export function registerUpdateCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("update").description("Update a project");
	projectRefArgument(cmd, "optional");
	cmd
		.option("--name <name>", "New project name")
		.option("--note <text>", "Project note")
		.option("--note-append <text>", "Append to project note")
		.option("--status <status>", "Project status")
		.option("--folder <folder>", "Parent folder")
		.option("--sequential", "Make the project sequential")
		.option("--parallel", "Make the project parallel")
		.option("--flag", "Flag the project")
		.option("--unflag", "Remove flag from the project")
		.action(
			runAction(async (ctx, project: string | undefined) => {
				const data = unwrapBridgeResponse(
					await client.updateProject({
						query: project,
						id: ctx.opts.id as string | undefined,
						name: ctx.opts.name as string | undefined,
						note: ctx.opts.note as string | undefined,
						noteAppend: ctx.opts.noteAppend as string | undefined,
						status: ctx.opts.status as string | undefined,
						folder: ctx.opts.folder as string | undefined,
						sequential: ctx.opts.sequential as boolean | undefined,
						parallel: ctx.opts.parallel as boolean | undefined,
						flag: ctx.opts.flag as boolean | undefined,
						unflag: ctx.opts.unflag as boolean | undefined,
					}),
				);
				if (ctx.format === "json") {
					outputJson(data);
					return;
				}
				outputChanges("project", data.project.name, data.changes);
			}),
		);
}
