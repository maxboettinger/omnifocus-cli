import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputProjectList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { listQueryOptions, readListQuery } from "../options/common.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent
		.command("list")
		.description("List projects")
		.option("--status <status>", "Filter by status, active|done|onhold|dropped")
		.option("--folder <folder>", "Filter by folder")
		.option("--full", "Verbose output");
	listQueryOptions(cmd, { count: "Include task counts", activeOnly: "Show only active projects" });
	cmd.action(
		runAction(async (ctx) => {
			const data = unwrapBridgeResponse(
				await client.listProjects({
					...readListQuery(ctx.opts),
					status: ctx.opts.status as string | undefined,
					folder: ctx.opts.folder as string | undefined,
					full: ctx.opts.full as boolean | undefined,
				}),
			);
			outputProjectList(data, ctx.format);
		}),
	);
}
