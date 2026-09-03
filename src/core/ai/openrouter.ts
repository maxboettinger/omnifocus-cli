/**
 * The OpenRouter adapter — the only module that imports `@openrouter/sdk`.
 *
 * Everything above it talks to the narrow `AIClient` interface, so the SDK
 * is a replaceable detail. The SDK is loaded with a dynamic `import()`
 * inside `createOpenRouterClient()` so a run that never talks to a model
 * (every non-AI verb, every `--json` listing) never evaluates it —
 * the same rule the spinner library follows.
 *
 * Structured output is requested as a strict `json_schema` response
 * format and routed only to providers that honour it
 * (`provider.requireParameters`). The reply is still parsed and validated
 * here; a response that fails validation is sent back to the model once
 * with the problems listed, and a second failure is an `AIError`.
 */

import { describeAISetup } from "./config.js";
import type { AIConfig } from "./config.js";
import {
	type AIClient,
	AIError,
	type ChatRequest,
	type ChatResult,
	type ChatUsage,
	type Message,
	type StructuredResult,
	type StructuredSchema,
	isValidationFailure,
} from "./types.js";

type Sdk = typeof import("@openrouter/sdk");
type SdkErrors = typeof import("@openrouter/sdk/models/errors");

let sdkLoaded = false;

/** True once the SDK module has been evaluated in this process (test guard). */
export function isSdkLoaded(): boolean {
	return sdkLoaded;
}

export interface OpenRouterOptions {
	/** Override the API base URL (tests point this at a local fake server). */
	serverURL?: string;
}

export const MAX_STRUCTURED_ATTEMPTS = 2;

/** Content can be a plain string or a list of typed parts; we only keep text. */
function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") return part;
				if (
					part &&
					typeof part === "object" &&
					typeof (part as { text?: unknown }).text === "string"
				) {
					return (part as { text: string }).text;
				}
				return "";
			})
			.join("");
	}
	return "";
}

function usageOf(usage: unknown): ChatUsage | undefined {
	if (!usage || typeof usage !== "object") return undefined;
	const { promptTokens, completionTokens } = usage as Record<string, unknown>;
	if (typeof promptTokens !== "number" || typeof completionTokens !== "number") return undefined;
	return { prompt: promptTokens, completion: completionTokens };
}

/** Strip a ```json fence some models wrap around structured output. */
export function stripCodeFence(text: string): string {
	const trimmed = text.trim();
	const match = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
	return match ? (match[1] as string).trim() : trimmed;
}

function detailOf(error: unknown): string {
	const nested = (error as { error?: { message?: unknown } }).error;
	if (nested && typeof nested.message === "string" && nested.message) return nested.message;
	if (error instanceof Error && error.message) return error.message;
	return String(error);
}

function mapError(error: unknown, errors: SdkErrors, model: string): AIError {
	if (error instanceof AIError) return error;
	// Checked first: these extend OpenRouterError but describe a reply we could
	// not decode (statusCode 200), not a failed request.
	if (
		error instanceof errors.SDKValidationError ||
		error instanceof errors.ResponseValidationError
	) {
		return new AIError("invalid-response", `Unexpected OpenRouter response: ${detailOf(error)}`);
	}
	if (error instanceof errors.OpenRouterError) {
		const status = error.statusCode;
		const detail = detailOf(error);
		if (status === 401 || status === 403) {
			return new AIError(
				"auth",
				`OpenRouter rejected the API key (HTTP ${status}): ${detail}\n${describeAISetup()}`,
			);
		}
		if (status === 402) {
			return new AIError(
				"credits",
				`OpenRouter reports insufficient credits: ${detail}\nTop up at https://openrouter.ai/credits`,
			);
		}
		if (status === 429) {
			return new AIError("rate-limit", `OpenRouter rate limit hit for ${model}: ${detail}`);
		}
		if (status === 400 || status === 404 || status === 422) {
			return new AIError(
				"bad-request",
				`OpenRouter rejected the request for ${model} (HTTP ${status}): ${detail}\nTry another model with --model <id>.`,
			);
		}
		return new AIError("network", `OpenRouter request failed (HTTP ${status}): ${detail}`);
	}
	if (error instanceof errors.RequestAbortedError) return new AIError("aborted", "Request aborted");
	if (error instanceof Error && error.name === "AbortError") {
		return new AIError("aborted", "Request aborted");
	}
	return new AIError("network", `Could not reach OpenRouter: ${detailOf(error)}`);
}

export async function createOpenRouterClient(
	config: AIConfig,
	opts: OpenRouterOptions = {},
): Promise<AIClient> {
	const sdk: Sdk = await import("@openrouter/sdk");
	const errors: SdkErrors = await import("@openrouter/sdk/models/errors");
	sdkLoaded = true;

	const client = new sdk.OpenRouter({
		apiKey: config.apiKey,
		httpReferer: config.referer,
		appTitle: config.title,
		// No silent retries: a CLI user sees the failure and decides; retrying
		// a 5xx with backoff would look like a hang.
		retryConfig: { strategy: "none" },
		...(opts.serverURL ? { serverURL: opts.serverURL } : {}),
	});

	type ChatRequestBody = Parameters<typeof client.chat.send>[0]["chatRequest"];

	function body(req: ChatRequest, messages: Message[]): ChatRequestBody {
		return {
			model: req.model ?? config.model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })) as never,
			...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
			...(req.maxTokens !== undefined ? { maxCompletionTokens: req.maxTokens } : {}),
		};
	}

	async function send(
		chatRequest: ChatRequestBody,
		signal: AbortSignal | undefined,
		model: string,
	) {
		try {
			return await client.chat.send(
				{ chatRequest },
				signal ? { fetchOptions: { signal } } : undefined,
			);
		} catch (error) {
			throw mapError(error, errors, model);
		}
	}

	function isStream(result: unknown): result is AsyncIterable<unknown> {
		return typeof result === "object" && result !== null && Symbol.asyncIterator in result;
	}

	function toChatResult(result: unknown, requestedModel: string): ChatResult {
		const r = result as {
			choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }>;
			model?: string;
			usage?: unknown;
		};
		const choice = r.choices?.[0];
		const content = textOf(choice?.message?.content);
		if (!content && typeof choice?.message?.refusal === "string" && choice.message.refusal) {
			throw new AIError("invalid-response", `The model refused: ${choice.message.refusal}`);
		}
		return { content, model: r.model || requestedModel, usage: usageOf(r.usage) };
	}

	return {
		async chat(req) {
			const model = req.model ?? config.model;
			const result = await send({ ...body(req, req.messages), stream: false }, req.signal, model);
			if (isStream(result)) throw new AIError("invalid-response", "Expected a complete response");
			return toChatResult(result, model);
		},

		async stream(req, onDelta) {
			const model = req.model ?? config.model;
			const result = await send({ ...body(req, req.messages), stream: true }, req.signal, model);
			if (!isStream(result)) {
				const whole = toChatResult(result, model);
				if (whole.content) onDelta(whole.content);
				return whole;
			}
			let content = "";
			let answeredBy = "";
			let usage: ChatUsage | undefined;
			try {
				for await (const chunk of result as AsyncIterable<{
					choices?: Array<{ delta?: { content?: unknown } }>;
					model?: string;
					usage?: unknown;
					error?: { message?: string };
				}>) {
					if (chunk.error) {
						throw new AIError("network", `OpenRouter stream error: ${chunk.error.message ?? ""}`);
					}
					const delta = textOf(chunk.choices?.[0]?.delta?.content);
					if (delta) {
						content += delta;
						onDelta(delta);
					}
					if (chunk.model) answeredBy = chunk.model;
					usage = usageOf(chunk.usage) ?? usage;
				}
			} catch (error) {
				throw mapError(error, errors, model);
			}
			return { content, model: answeredBy || model, usage };
		},

		async structured<T>(
			req: ChatRequest,
			schema: StructuredSchema<T>,
		): Promise<StructuredResult<T>> {
			const model = req.model ?? config.model;
			const messages = [...req.messages];
			for (let attempt = 1; ; attempt++) {
				const result = await send(
					{
						...body(req, messages),
						stream: false,
						responseFormat: {
							type: "json_schema",
							jsonSchema: { name: schema.name, strict: true, schema: schema.schema },
						},
						provider: { requireParameters: true },
					},
					req.signal,
					model,
				);
				if (isStream(result)) throw new AIError("invalid-response", "Expected a complete response");
				const chat = toChatResult(result, model);
				const raw = chat.content;
				let problems: string[];
				try {
					const validated = schema.validate(JSON.parse(stripCodeFence(raw)));
					if (!isValidationFailure(validated)) {
						return { value: validated.value, raw, model: chat.model, attempts: attempt };
					}
					problems = validated.errors;
				} catch (error) {
					problems = [
						`response is not valid JSON: ${error instanceof Error ? error.message : error}`,
					];
				}
				if (attempt >= MAX_STRUCTURED_ATTEMPTS) {
					throw new AIError(
						"invalid-response",
						`${chat.model} returned an invalid ${schema.name} after ${attempt} attempts:\n- ${problems.join("\n- ")}`,
					);
				}
				messages.push(
					{ role: "assistant", content: raw },
					{
						role: "user",
						content: `Your previous response failed validation:\n- ${problems.join("\n- ")}\nReturn the complete corrected JSON object only.`,
					},
				);
			}
		},
	};
}
