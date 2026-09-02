import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { outputFolderList } from "../../core/output.js";
import type { OmniFocusClient } from "../../core/types.js";
import { runAction } from "../action.js";
import { listQueryOptions, readListQuery } from "../options/common.js";

export function registerListCommand(parent: Command, client: OmniFocusClient): void {
	const cmd = parent.command("list").description("List folders");
	listQueryOptions(cmd, { count: "Include project counts" });
	cmd.action(
		runAction(async (ctx) => {
			const data = unwrapBridgeResponse(await client.listFolders(readListQuery(ctx.opts)));
			outputFolderList(data, ctx.format);
		}),
	);
}
