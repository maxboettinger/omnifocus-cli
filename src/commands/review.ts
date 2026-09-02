import type { Command } from "commander";
import { unwrapBridgeResponse } from "../core/client.js";
import { outputJson } from "../core/output.js";
import { parseIntOption } from "../core/parsers.js";
import type { OmniFocusClient } from "../core/types.js";
import { bold, dim, green } from "../core/ui/colors.js";
import { runAction } from "./action.js";

export function registerReviewCommand(program: Command, client: OmniFocusClient): void {
	program
		.command("review")
		.description("Weekly review report")
		.option("--days <n>", "Number of days to review", parseIntOption, 7)
		.action(
			runAction(async (ctx) => {
				const { opts, format } = ctx;

				const days = opts.days as number;

				const response = await client.review({ days });
				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				// Human-friendly output
				console.log(bold(`Review: ${data.meta.periodStart} to ${data.meta.periodEnd}`));
				console.log(dim(`Generated at ${new Date(data.meta.generatedAt).toLocaleString()}`));
				console.log(dim(`Period: ${data.meta.daysReviewed} days\n`));

				// Summary stats
				console.log(bold("Summary"));
				console.log(`  ${green("✓")} Tasks completed: ${data.summary.totalCompleted}`);
				console.log(`  ⏱️  Total estimated: ${data.summary.totalEstimatedMinutes} minutes`);
				console.log("");

				// By-project breakdown
				if (Object.keys(data.summary.byProject).length > 0) {
					console.log(bold("By Project"));
					// Sort projects by count descending
					const sortedProjects = Object.entries(data.summary.byProject).sort(
						([, a], [, b]) => b - a,
					);
					for (const [project, count] of sortedProjects) {
						console.log(`  ${project}: ${count} tasks`);
					}
					console.log("");
				}

				// By-day breakdown
				if (Object.keys(data.summary.byDay).length > 0) {
					console.log(bold("By Day"));
					// Sort days chronologically
					const sortedDays = Object.entries(data.summary.byDay).sort(([a], [b]) =>
						a.localeCompare(b),
					);
					for (const [day, count] of sortedDays) {
						const dayFormatted = new Date(day).toLocaleDateString("en-US", {
							weekday: "short",
							month: "short",
							day: "numeric",
						});
						console.log(`  ${dayFormatted}: ${count} tasks`);
					}
					console.log("");
				}

				// Project progress
				if (data.projectProgress.length > 0) {
					console.log(bold("Project Progress"));
					for (const project of data.projectProgress) {
						const progressBar =
							"█".repeat(Math.floor(project.percentage / 10)) +
							"░".repeat(10 - Math.floor(project.percentage / 10));
						console.log(
							`  ${project.name}: ${project.completedCount}/${project.taskCount} tasks (${project.percentage}%)`,
						);
						console.log(dim(`    ${progressBar}`));
					}
				}
			}),
		);
}
