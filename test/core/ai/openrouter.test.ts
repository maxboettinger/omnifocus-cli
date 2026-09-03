/**
 * The OpenRouter adapter against a local fake of the OpenRouter HTTP API.
 * The real SDK runs end to end (request shaping, SSE parsing, typed
 * errors); only the network is faked, via `serverURL`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { AIConfig } from "../../../src/core/ai/config.js";
import {
	createOpenRouterClient,
	isSdkLoaded,
	stripCodeFence,
} from "../../../src/core/ai/openrouter.js";
import { PLAN_STRUCTURED } from "../../../src/core/ai/plan.js";
import { type AIClient, AIError, type StructuredSchema } from "../../../src/core/ai/types.js";

interface Recorded {
	headers: Record<string, string>;
	body: Record<string, unknown>;
}

type Reply =
	| { status: number; json: unknown }
	| { sse: string[] }
	| { text: string; content: string; model?: string };

const recorded: Recorded[] = [];
const replies: Reply[] = [];
let server: ReturnType<typeof Bun.serve>;

function completion(content: string, model = "test/model", extra: Record<string, unknown> = {}) {
	return {
		id: "gen-1",
		object: "chat.completion",
		created: 1,
		model,
		system_fingerprint: "fp",
		choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
		usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
		...extra,
	};
}

function chunk(content: string, model = "test/model") {
	return JSON.stringify({
		id: "gen-1",
		object: "chat.completion.chunk",
		created: 1,
		model,
		choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
	});
}

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname !== "/api/v1/chat/completions") {
				return new Response("not found", { status: 404 });
			}
			const headers: Record<string, string> = {};
			req.headers.forEach((v, k) => {
				headers[k.toLowerCase()] = v;
			});
			recorded.push({ headers, body: (await req.json()) as Record<string, unknown> });
			const reply = replies.shift();
			if (!reply) {
				return new Response(JSON.stringify(completion("(no reply queued)")), {
					headers: { "content-type": "application/json" },
				});
			}
			if ("sse" in reply) {
				const body = `${reply.sse.map((line) => `data: ${line}\n\n`).join("")}data: [DONE]\n\n`;
				return new Response(body, { headers: { "content-type": "text/event-stream" } });
			}
			if ("json" in reply) {
				return new Response(JSON.stringify(reply.json), {
					status: reply.status,
					headers: { "content-type": "application/json" },
				});
			}
			return new Response(JSON.stringify(completion(reply.content, reply.model)), {
				headers: { "content-type": "application/json" },
			});
		},
	});
});

afterAll(() => {
	server.stop(true);
});

beforeEach(() => {
	recorded.length = 0;
	replies.length = 0;
});

const config: AIConfig = {
	apiKey: "sk-test",
	model: "test/default",
	referer: "https://example.test/app",
	title: "of-test",
};

async function client(): Promise<AIClient> {
	return createOpenRouterClient(config, { serverURL: `http://127.0.0.1:${server.port}/api/v1` });
}

const messages = [
	{ role: "system" as const, content: "You are terse." },
	{ role: "user" as const, content: "Hi" },
];

describe("createOpenRouterClient", () => {
	test("loads the SDK lazily and sends a well-formed chat request", async () => {
		replies.push({ text: "", content: "Hello!", model: "test/model" });
		const ai = await client();
		expect(isSdkLoaded()).toBe(true);
		const result = await ai.chat({ messages, temperature: 0.3, maxTokens: 50 });
		expect(result).toEqual({
			content: "Hello!",
			model: "test/model",
			usage: { prompt: 10, completion: 5 },
		});
		const sent = recorded[0] as Recorded;
		expect(sent.headers.authorization).toBe("Bearer sk-test");
		expect(sent.headers["http-referer"]).toBe("https://example.test/app");
		expect(sent.headers["x-openrouter-title"]).toBe("of-test");
		expect(sent.body).toMatchObject({
			model: "test/default",
			messages,
			temperature: 0.3,
			max_completion_tokens: 50,
			stream: false,
		});
	});

	test("a per-request model overrides the configured one", async () => {
		replies.push({ text: "", content: "ok" });
		const ai = await client();
		await ai.chat({ messages, model: "other/model" });
		expect((recorded[0] as Recorded).body.model).toBe("other/model");
	});

	test("streams deltas and returns the assembled text", async () => {
		replies.push({ sse: [chunk("Hel"), chunk("lo"), chunk(" there")] });
		const ai = await client();
		const deltas: string[] = [];
		const result = await ai.stream({ messages }, (d) => deltas.push(d));
		expect(deltas).toEqual(["Hel", "lo", " there"]);
		expect(result.content).toBe("Hello there");
		expect(result.model).toBe("test/model");
		expect((recorded[0] as Recorded).body.stream).toBe(true);
	});

	test("maps HTTP errors to AIError kinds", async () => {
		const cases: Array<[number, string]> = [
			[401, "auth"],
			[402, "credits"],
			[429, "rate-limit"],
			[400, "bad-request"],
			[500, "network"],
		];
		const ai = await client();
		for (const [status, kind] of cases) {
			replies.push({ status, json: { error: { code: status, message: `boom ${status}` } } });
			let caught: unknown;
			try {
				await ai.chat({ messages });
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(AIError);
			expect((caught as AIError).kind).toBe(kind as AIError["kind"]);
			expect((caught as AIError).message).toContain(`boom ${status}`);
		}
	});

	test("an aborted request surfaces as kind aborted", async () => {
		const ai = await client();
		const controller = new AbortController();
		controller.abort();
		let caught: unknown;
		try {
			await ai.chat({ messages, signal: controller.signal });
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(AIError);
		expect((caught as AIError).kind).toBe("aborted");
	});

	test("structured: sends a strict json_schema format and validates the reply", async () => {
		const plan = {
			summary: "s",
			sequential: true,
			questions: [],
			tasks: [
				{
					key: "1",
					parentKey: null,
					name: "Open the app",
					note: "",
					estimateMinutes: 2,
					tags: [],
					flag: false,
					sequential: false,
					due: null,
					defer: null,
				},
			],
		};
		replies.push({ text: "", content: `\`\`\`json\n${JSON.stringify(plan)}\n\`\`\`` });
		const ai = await client();
		const result = await ai.structured({ messages }, PLAN_STRUCTURED);
		expect(result.attempts).toBe(1);
		expect(result.value.tasks[0]?.name).toBe("Open the app");
		const body = (recorded[0] as Recorded).body;
		expect(body.response_format).toEqual({
			type: "json_schema",
			json_schema: { name: "task_breakdown_plan", strict: true, schema: PLAN_STRUCTURED.schema },
		});
		expect(body.provider).toEqual({ require_parameters: true });
	});

	test("structured: retries once with the validation problems, then succeeds", async () => {
		const schema: StructuredSchema<{ n: number }> = {
			name: "num",
			schema: { type: "object" },
			validate: (raw) =>
				typeof raw === "object" && raw !== null && typeof (raw as { n?: unknown }).n === "number"
					? { value: raw as { n: number } }
					: { errors: ["n must be a number"] },
		};
		replies.push({ text: "", content: '{"n": "one"}' }, { text: "", content: '{"n": 1}' });
		const ai = await client();
		const result = await ai.structured({ messages }, schema);
		expect(result).toMatchObject({ value: { n: 1 }, attempts: 2, raw: '{"n": 1}' });
		const retry = (recorded[1] as Recorded).body.messages as Array<{
			role: string;
			content: string;
		}>;
		expect(retry).toHaveLength(4);
		expect(retry[2]).toEqual({ role: "assistant", content: '{"n": "one"}' });
		expect(retry[3]?.role).toBe("user");
		expect(retry[3]?.content).toContain("n must be a number");
	});

	test("structured: gives up after the second invalid reply", async () => {
		const schema: StructuredSchema<never> = {
			name: "never",
			schema: { type: "object" },
			validate: () => ({ errors: ["always wrong"] }),
		};
		replies.push({ text: "", content: "{}" }, { text: "", content: "not json" });
		const ai = await client();
		let caught: unknown;
		try {
			await ai.structured({ messages }, schema);
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(AIError);
		expect((caught as AIError).kind).toBe("invalid-response");
		expect((caught as AIError).message).toContain("2 attempts");
		expect((caught as AIError).message).toContain("not valid JSON");
		expect(recorded).toHaveLength(2);
	});
});

describe("stripCodeFence", () => {
	test("removes a fenced block and leaves plain text alone", () => {
		expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
		expect(stripCodeFence('```\n{"a":1}```')).toBe('{"a":1}');
		expect(stripCodeFence('  {"a":1} ')).toBe('{"a":1}');
	});
});
