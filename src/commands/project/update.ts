import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputChanges, outputJson, resolveFormat } from "../../core/output.js";
import { outputError } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";

export function registerUpdateCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("update")
		.description("Update a project")
		.argument("[query]", "Project name or search query (optional when --id is provided)")
		.option("--id <id>", "Project ID")
		.option("--name <name>", "New project name")
		.option("--note <text>", "Project note")
		.option("--note-append <text>", "Append to project note")
		.option("--status <status>", "Project status")
		.option("--folder <name>", "Parent folder")
		.option("--sequential", "Make project sequential")
		.option("--parallel", "Make project parallel")
		.option("--flag", "Flag the project")
		.option("--unflag", "Remove flag from project")
		.option("--json", "JSON output")
		.action(async (query: string | undefined, opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const updateOptions = {
					query,
					id: opts.id as string,
					name: opts.name as string,
					note: opts.note as string,
					noteAppend: opts.noteAppend as string,
					status: opts.status as string,
					folder: opts.folder as string,
					sequential: opts.sequential as boolean,
					parallel: opts.parallel as boolean,
					flag: opts.flag as boolean,
					unflag: opts.unflag as boolean,
				};

				const response = await client.updateProject(updateOptions);
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				outputChanges("project", data.project.name, data.changes);
			} catch (error) {
				outputError(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});
}
