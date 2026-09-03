/**
 * Scripted `AIClient` for tests — the model-side counterpart of
 * `createMockClient()`. Replies and plans are queues consumed in order;
 * every request is recorded so tests can assert on prompts, history and
 * per-request options. Plans go through the real schema validator, so a
 * test fixture that would not survive the production path fails loudly.
 */

import { Conversation } from "../../src/core/ai/conversation.js";
import {
	type AIClient,
	AIError,
	type ChatRequest,
	type StructuredSchema,
	isValidationFailure,
} from "../../src/core/ai/types.js";

export interface FakeAIScript {
	/** Successive `chat`/`stream` replies. */
	replies?: string[];
	/** Successive `structured` replies (raw JSON values). */
	plans?: unknown[];
}

export interface FakeAI extends AIClient {
	requests: ChatRequest[];
	/** Add more scripted output mid-test. */
	queue(script: FakeAIScript): void;
}

export const FAKE_MODEL = "fake/model";

export function createFakeAI(script: FakeAIScript = {}): FakeAI {
	const replies = [...(script.replies ?? [])];
	const plans = [...(script.plans ?? [])];
	const requests: ChatRequest[] = [];

	function next<T>(queue: T[], what: string): T {
		if (queue.length === 0) throw new AIError("invalid-response", `fake AI has no ${what} queued`);
		return queue.shift() as T;
	}

	return {
		requests,
		queue(more) {
			replies.push(...(more.replies ?? []));
			plans.push(...(more.plans ?? []));
		},
		async chat(req) {
			requests.push(req);
			return { content: next(replies, "reply"), model: FAKE_MODEL };
		},
		async stream(req, onDelta) {
			requests.push(req);
			const content = next(replies, "reply");
			onDelta(content);
			return { content, model: FAKE_MODEL };
		},
		async structured<T>(req: ChatRequest, schema: StructuredSchema<T>) {
			requests.push(req);
			const raw = next(plans, "plan");
			const validated = schema.validate(raw);
			if (isValidationFailure(validated)) {
				throw new AIError(
					"invalid-response",
					`fake plan does not satisfy ${schema.name}:\n- ${validated.errors.join("\n- ")}`,
				);
			}
			return { value: validated.value, raw: JSON.stringify(raw), model: FAKE_MODEL, attempts: 1 };
		},
	};
}

/** Convenience for asserting on the last request's message roles/contents. */
export function lastRequest(ai: FakeAI): ChatRequest {
	const last = ai.requests[ai.requests.length - 1];
	if (!last) throw new Error("fake AI received no requests");
	return last;
}

// Keep the Conversation import meaningful for fixture authors building histories.
export { Conversation };
