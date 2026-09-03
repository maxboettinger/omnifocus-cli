import { describe, expect, test } from "bun:test";
import { createAIClient } from "../../../src/core/ai/client.js";
import { Conversation } from "../../../src/core/ai/conversation.js";
import { AIError } from "../../../src/core/ai/types.js";
import { withEnv } from "../../helpers/env.js";

describe("createAIClient", () => {
	test("constructing it never throws; a missing key surfaces on first use", async () => {
		const ai = createAIClient();
		let caught: unknown;
		await withEnv({ OPENROUTER_API_KEY: undefined }, async () => {
			try {
				await ai.chat({ messages: [{ role: "user", content: "hi" }] });
			} catch (error) {
				caught = error;
			}
		});
		expect(caught).toBeInstanceOf(AIError);
		expect((caught as AIError).kind).toBe("missing-key");
	});
});

describe("Conversation", () => {
	test("keeps the system prompt first and hands out copies", () => {
		const convo = new Conversation("sys").user("q1").assistant("a1").user("q2");
		expect(convo.messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
		expect(convo.userTurns).toBe(2);
		convo.messages.push({ role: "user", content: "leak?" });
		expect(convo.messages).toHaveLength(4);
	});
});
