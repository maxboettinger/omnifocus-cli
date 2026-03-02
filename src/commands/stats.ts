import type { Command } from "commander";
import { unwrapBridgeResponse } from "../core/client.js";
import { BridgeError } from "../core/errors.js";
import {
	bold,
	green,
	outputError,
	outputJson,
	red,
	resolveFormat,
	yellow,
} from "../core/output.js";
import type { OmniFocusClient } from "../core/types.js";

export function registerStatsCommand(program: Command, client: OmniFocusClient): void {
	program
		.command("stats")
		.description("OmniFocus statistics overview")
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const response = await client.stats();
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				// Human-friendly output
				console.log(bold("OmniFocus Statistics\n"));

				// Task statistics
				console.log(bold("📋 Tasks"));
				console.log(`  Total: ${data.tasks.total}`);
				console.log(`  ${yellow("●")} Incomplete: ${data.tasks.incomplete}`);
				console.log(`  ${green("✓")} Completed: ${data.tasks.completed}`);
				console.log(`  📥 Inbox: ${data.tasks.inbox}`);
				console.log(`  ⚑ Flagged: ${data.tasks.flagged}`);
				console.log(`  ${red("!")} Overdue: ${data.tasks.overdue}`);
				console.log(`  ⏰ Due soon: ${data.tasks.dueSoon}`);
				console.log(`  ✅ Available: ${data.tasks.available}`);
				console.log(`  🚫 Blocked: ${data.tasks.blocked}`);
				console.log(`  ⏱️  With estimates: ${data.tasks.withEstimates}`);
				console.log(`  📊 Total estimated minutes: ${data.tasks.totalEstimatedMinutes}`);
				console.log(`  🔄 Repeating: ${data.tasks.repeating}`);
				console.log(`  📋 Sequential: ${data.tasks.sequential}`);
				console.log("");

				// Project statistics
				console.log(bold("📁 Projects"));
				console.log(`  Total: ${data.projects.total}`);
				console.log(`  ${green("●")} Active: ${data.projects.active}`);
				console.log(`  ${yellow("⏸")} On hold: ${data.projects.onHold}`);
				console.log(`  ${green("✓")} Completed: ${data.projects.completed}`);
				console.log(`  ${red("✗")} Dropped: ${data.projects.dropped}`);
				console.log("");

				// Calculated insights
				console.log(bold("📊 Insights"));

				// Completion rate
				const completionRate =
					data.tasks.total > 0 ? Math.round((data.tasks.completed / data.tasks.total) * 100) : 0;
				console.log(`  Completion rate: ${completionRate}%`);

				// Average estimate
				const avgEstimate =
					data.tasks.withEstimates > 0
						? Math.round(data.tasks.totalEstimatedMinutes / data.tasks.withEstimates)
						: 0;
				console.log(`  Average estimate: ${avgEstimate} minutes`);

				// Project health
				const activeProjectHealth =
					data.projects.total > 0
						? Math.round((data.projects.active / data.projects.total) * 100)
						: 0;
				console.log(`  Active project ratio: ${activeProjectHealth}%`);

				// Task distribution
				const inboxRatio =
					data.tasks.total > 0 ? Math.round((data.tasks.inbox / data.tasks.total) * 100) : 0;
				console.log(`  Inbox ratio: ${inboxRatio}%`);

				const flaggedRatio =
					data.tasks.incomplete > 0
						? Math.round((data.tasks.flagged / data.tasks.incomplete) * 100)
						: 0;
				console.log(`  Flagged ratio: ${flaggedRatio}%`);

				// Health indicators
				if (data.tasks.overdue > 0) {
					console.log(`  ${red("⚠")} ${data.tasks.overdue} overdue tasks need attention`);
				}
				if (inboxRatio > 20) {
					console.log(`  ${yellow("💭")} High inbox ratio - consider processing`);
				}
				if (data.tasks.blocked > 0) {
					console.log(`  ${yellow("🚫")} ${data.tasks.blocked} blocked tasks`);
				}
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error.format());
					process.exit(1);
				}
				throw error;
			}
		});
}
