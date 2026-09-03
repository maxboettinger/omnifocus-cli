/**
 * `createAIClient()` — the production `AIClient`, created once at the
 * entry point and threaded into every verb next to the OmniFocus client.
 *
 * It is lazy on purpose: constructing it costs nothing and cannot fail.
 * Config (API key, model) is resolved and the OpenRouter adapter — and
 * with it the SDK — is loaded on the first call, so a missing key only
 * surfaces when a verb actually needs the model, and a run that never
 * does pays nothing.
 */

import { resolveAIConfig } from "./config.js";
import type { AIClient, ChatRequest, StructuredSchema } from "./types.js";

export function createAIClient(): AIClient {
	let pending: Promise<AIClient> | undefined;
	const backend = (): Promise<AIClient> => {
		if (!pending) {
			pending = (async () => {
				const config = resolveAIConfig();
				const { createOpenRouterClient } = await import("./openrouter.js");
				return createOpenRouterClient(config);
			})();
		}
		return pending;
	};
	return {
		chat: (req: ChatRequest) => backend().then((c) => c.chat(req)),
		stream: (req, onDelta) => backend().then((c) => c.stream(req, onDelta)),
		structured: <T>(req: ChatRequest, schema: StructuredSchema<T>) =>
			backend().then((c) => c.structured(req, schema)),
	};
}
