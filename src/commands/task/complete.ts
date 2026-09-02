import type { Command } from "commander";
import { unwrapBridgeResponse } from "../../core/client.js";
import { BridgeError, CLIError } from "../../core/errors.js";
import { outputError, outputJson, outputSuccess } from "../../core/output.js";
import { peekShortId, resolveTaskRef } from "../../core/short-ids.js";
import type { BridgeCandidate, OmniFocusClient, TaskCompleteResult } from "../../core/types.js";
import { runAction } from "../action.js";

type RefOutcome =
	| { ref: string | undefined; ok: true; data: TaskCompleteResult }
	| { ref: string | undefined; ok: false; error: BridgeError };

/**
 * `of task complete <refs...>` — also mounted at the root as `of complete`
 * (see ../shortcuts.ts). Each reference is resolved and completed through
 * the single-task `task.complete` op so every one of them keeps the full
 * semantics: short-id aliases, fuzzy names, disambiguation candidates and
 * the "already completed" hint.
 */
export function registerCompleteCommand(parent: Command, client: OmniFocusClient): void {
	parent
		.command("complete")
		.description("Complete one or more tasks")
		.argument("[refs...]", "Task references: short id, name query (can be omitted with --id)")
		.option("--id <id>", "Task ID (single task only)")
		.option("--incomplete", "Mark as incomplete instead")
		.option("--json", "JSON output")
		.action(
			runAction(async (ctx, refs: string[]) => {
				const explicitId = ctx.opts.id as string | undefined;
				const incomplete = ctx.opts.incomplete as boolean | undefined;

				if (refs.length > 1 && explicitId) {
					throw new CLIError("--id can only be combined with a single task reference");
				}

				const completeOne = async (ref: string | undefined): Promise<RefOutcome> => {
					const resolved = resolveTaskRef(ref, explicitId);
					try {
						const response = await client.completeTask(ref as string, {
							id: resolved.id,
							incomplete,
						});
						return { ref, ok: true, data: unwrapBridgeResponse(response) };
					} catch (error) {
						if (error instanceof BridgeError) return { ref, ok: false, error };
						throw error;
					}
				};

				// Single reference: unchanged contract (bare object / plain error).
				if (refs.length <= 1) {
					const outcome = await completeOne(refs[0]);
					if (!outcome.ok) throw outcome.error;
					if (ctx.format === "json") outputJson(outcome.data);
					else outputSuccess(confirmation(outcome.data));
					return;
				}

				// Several references: report every one, then fail if any failed.
				const outcomes: RefOutcome[] = [];
				for (const ref of refs) {
					const outcome = await completeOne(ref);
					outcomes.push(outcome);
					if (ctx.format === "human") {
						if (outcome.ok) outputSuccess(confirmation(outcome.data));
						else outputError(outcome.error);
					}
				}

				if (ctx.format === "json") outputJson(outcomes.map(toJsonResult));

				if (outcomes.some((o) => !o.ok)) process.exit(1);
			}),
		);
}

function confirmation(data: TaskCompleteResult): string {
	const action = data.action === "completed" ? "Completed" : "Marked incomplete";
	const shortId = peekShortId(data.id);
	return `${action}: ${data.name}${shortId != null ? ` (${shortId})` : ""}`;
}

type JsonResult =
	| ({ ref: string | undefined; ok: true } & TaskCompleteResult)
	| { ref: string | undefined; ok: false; error: string; candidates?: BridgeCandidate[] };

function toJsonResult(outcome: RefOutcome): JsonResult {
	if (outcome.ok) return { ref: outcome.ref, ok: true, ...outcome.data };
	const { message, candidates } = outcome.error;
	return {
		ref: outcome.ref,
		ok: false,
		error: message,
		...(candidates && candidates.length > 0 ? { candidates } : {}),
	};
}
