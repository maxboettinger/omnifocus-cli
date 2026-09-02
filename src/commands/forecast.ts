import type { Command } from "commander";
import { unwrapBridgeResponse } from "../core/client.js";
import { BridgeError } from "../core/errors.js";
import {
	formatTaskLine,
	outputError,
	outputJson,
	resolveFormat,
	shortIdColumnWidth,
	taskShortIds,
} from "../core/output.js";
import { parseIntOption } from "../core/parsers.js";
import type { OmniFocusClient } from "../core/types.js";
import { bold, cyan, dim, green, red, yellow } from "../core/ui/colors.js";

export function registerForecastCommand(program: Command, client: OmniFocusClient): void {
	program
		.command("forecast")
		.description("Show today's categorized task view")
		.option("--days <n>", "Number of days to include", parseIntOption, 3)
		.option("--include-flagged", "Include flagged tasks")
		.option("--include-available", "Include available tasks")
		.option("--json", "JSON output")
		.action(async (opts: Record<string, unknown>, cmd: Command) => {
			try {
				const format = resolveFormat((opts.json as boolean) || cmd.optsWithGlobals().json);

				const days = opts.days as number;
				const includeFlagged = opts.includeFlagged as boolean;
				const includeAvailable = opts.includeAvailable as boolean;

				const response = await client.forecast({
					days,
					includeFlagged,
					includeAvailable,
				});

				const data = unwrapBridgeResponse(response);

				if (format === "json") {
					outputJson(data);
					return;
				}

				// Human-friendly output
				console.log(bold(`Forecast for ${data.meta.today} (+${data.meta.upcomingDays} days)`));
				console.log(dim(`Generated at ${new Date(data.meta.generatedAt).toLocaleString()}\n`));

				// Show each bucket with tasks
				const buckets = [
					{ key: "overdue", label: "Overdue", tasks: data.overdue, color: red },
					{ key: "due_today", label: "Due Today", tasks: data.due_today, color: red },
					{
						key: "planned_today",
						label: "Planned Today",
						tasks: data.planned_today,
						color: yellow,
					},
					{
						key: "deferred_today",
						label: "Deferred Today",
						tasks: data.deferred_today,
						color: green,
					},
					{ key: "flagged", label: "Flagged", tasks: data.flagged, color: yellow },
					{ key: "upcoming", label: "Upcoming", tasks: data.upcoming, color: cyan },
					{
						key: "available_next",
						label: "Available Next",
						tasks: data.available_next,
						color: dim,
					},
				];

				// One alias pass across all buckets so ids align consistently.
				const aliases = taskShortIds(buckets.flatMap((b) => b.tasks));
				const width = shortIdColumnWidth(aliases);

				for (const bucket of buckets) {
					if (bucket.tasks.length === 0) continue;

					console.log(bucket.color(bold(`${bucket.label} (${bucket.tasks.length})`)));
					for (const task of bucket.tasks) {
						console.log(
							`  ${formatTaskLine(task, { shortId: aliases.get(task.id), shortIdWidth: width })}`,
						);
					}
					console.log("");
				}

				// Drag alerts
				if (data.meta.dragAlerts.length > 0) {
					console.log(red(bold("Drag Alerts")));
					for (const alert of data.meta.dragAlerts) {
						console.log(red(`  ${alert.name} (${alert.daysOverdue} days overdue)`));
						console.log(dim(`    ${alert.suggestion}`));
					}
					console.log("");
				}

				// Summary stats
				console.log(dim(`Total estimated: ${data.meta.totalEstimatedMinutes} minutes`));
				const counts = data.meta.counts;
				console.log(
					dim(
						`Tasks: ${counts.overdue} overdue, ${counts.dueToday} due today, ${counts.plannedToday} planned today`,
					),
				);
			} catch (error) {
				if (error instanceof BridgeError) {
					outputError(error);
					process.exit(1);
				}
				throw error;
			}
		});
}
