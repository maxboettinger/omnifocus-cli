import type { Command } from "commander";
import { renderTaskContext, todayString } from "../../core/ai/context.js";
import { Conversation } from "../../core/ai/conversation.js";
import { PLAN_STRUCTURED, type Plan, buildPlanTree } from "../../core/ai/plan.js";
import { loadPrompt } from "../../core/ai/prompts.js";
import type { AIClient, StructuredResult } from "../../core/ai/types.js";
import { unwrapBridgeResponse } from "../../core/client.js";
import { CLIError } from "../../core/errors.js";
import { outputJson, outputPlanTree, outputTreeResult } from "../../core/output.js";
import type {
	CreateTreeOptions,
	CreateTreeResult,
	OmniFocusClient,
	PlanTaskInput,
	TaskContext,
} from "../../core/types.js";
import { dim } from "../../core/ui/colors.js";
import { withSpinner } from "../../core/ui/progress.js";
import { createPrompter } from "../../core/ui/prompt.js";
import { runAction } from "../action.js";
import { readTaskRef, taskRefArgument } from "../options/refs.js";

const TEMPERATURE = 0.2;

/** Map a validated plan onto the bridge's create-tree payload. */
export function planToTreeOptions(parentId: string, plan: Plan): CreateTreeOptions {
	return {
		parentId,
		sequential: plan.sequential,
		tasks: plan.tasks.map(
			(t): PlanTaskInput => ({
				key: t.key,
				parentKey: t.parentKey,
				name: t.name,
				note: t.note,
				estimate: t.estimateMinutes,
				tags: t.tags,
				flag: t.flag,
				sequential: t.sequential,
				due: t.due,
				defer: t.defer,
			}),
		),
	};
}

/**
 * `of task breakdown <ref>` — ask the model for a nano-task plan under a
 * task, preview it, revise it with feedback as often as wanted, then apply
 * it in one `task.createTree` round-trip. In JSON mode the plan is printed
 * and nothing is applied unless `--apply` is passed.
 */
export function registerBreakdownCommand(
	parent: Command,
	client: OmniFocusClient,
	ai: AIClient,
): void {
	const cmd = parent
		.command("breakdown")
		.description("Break a task into AI-suggested nano subtasks, preview, then apply");
	taskRefArgument(cmd);
	cmd
		.option("--context <text>", "Extra context for the model")
		.option("--model <id>", "Model id, overrides $OF_AI_MODEL and the config file")
		.option("--apply", "Apply the plan without the interactive preview")
		.action(
			runAction(async (ctx, ref: string | undefined) => {
				const resolved = readTaskRef(ref, ctx.opts);
				if (!resolved.query && !resolved.id) throw new CLIError("Provide a task reference or --id");
				const apply = ctx.opts.apply === true;
				const interactive = ctx.format === "human" && !apply;
				if (interactive && process.stdin.isTTY !== true) {
					throw new CLIError(
						"task breakdown previews the plan interactively; run it in a terminal, or pass --apply to skip the preview, or --json to print the plan",
					);
				}

				const context: TaskContext = unwrapBridgeResponse(
					await client.getTaskContext(
						resolved.id ? { id: resolved.id } : { query: resolved.query as string },
					),
				);
				const target = {
					id: context.task.id,
					name: context.task.name,
					project: context.task.project,
				};
				const convo = new Conversation(loadPrompt("breakdown").text).user(
					`${renderTaskContext(context, {
						today: todayString(),
						extra: ctx.opts.context as string | undefined,
					})}\n\nBreak the target task down into nano tasks now.`,
				);
				const model = ctx.opts.model as string | undefined;
				// Ctrl-C while the model is working aborts the request cleanly
				// (surfacing as AIError "aborted") instead of killing the process mid-spinner.
				const generate = (label: string): Promise<StructuredResult<Plan>> => {
					const controller = new AbortController();
					const onSigint = () => controller.abort();
					process.once("SIGINT", onSigint);
					return withSpinner(label, () =>
						ai.structured(
							{
								messages: convo.messages,
								model,
								temperature: TEMPERATURE,
								signal: controller.signal,
							},
							PLAN_STRUCTURED,
						),
					).finally(() => process.off("SIGINT", onSigint));
				};
				const applyPlan = (plan: Plan): Promise<CreateTreeResult> =>
					client
						.createTaskTree(planToTreeOptions(target.id, plan))
						.then((response) => unwrapBridgeResponse(response));

				let result = await generate("Thinking…");
				convo.assistant(result.raw);

				if (ctx.format === "json") {
					const applied = apply ? await applyPlan(result.value) : null;
					outputJson({ target, model: result.model, plan: result.value, applied });
					if (applied?.created.some((c) => !c.ok)) process.exit(1);
					return;
				}

				const prompter = createPrompter({ output: process.stderr });
				try {
					for (;;) {
						outputPlanTree(
							{
								name: target.name,
								sequential: context.task.sequential,
								existingChildren: context.children.length,
							},
							result.value,
							buildPlanTree(result.value),
						);
						let choice = apply ? "a" : null;
						if (!apply) {
							console.log("");
							choice = await prompter.choose(
								`${dim("[a]")}pply, ${dim("[r]")}evise or ${dim("[q]")}uit: `,
								["a", "r", "q"],
							);
						}
						if (choice === null || choice === "q") {
							console.log(dim("Nothing changed."));
							return;
						}
						if (choice === "a") {
							const applied = await applyPlan(result.value);
							const summary = outputTreeResult(applied);
							if (summary.failed > 0) process.exit(1);
							return;
						}
						const feedback = await prompter.ask("What should change? ");
						if (feedback === null) {
							console.log(dim("Nothing changed."));
							return;
						}
						convo.user(feedback);
						result = await generate("Revising…");
						convo.assistant(result.raw);
						console.log("");
					}
				} finally {
					prompter.close();
				}
			}),
		);
}
