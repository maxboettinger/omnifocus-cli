import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	DEFAULT_MODEL,
	configPath,
	describeAISetup,
	resolveAIConfig,
	resolveAIModel,
} from "../../../src/core/ai/config.js";
import { AIError } from "../../../src/core/ai/types.js";
import { withEnv } from "../../helpers/env.js";

function configDirWith(content?: string): string {
	const dir = mkdtempSync(join(tmpdir(), "of-ai-config-"));
	if (content !== undefined) {
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "config.json"), content);
	}
	return dir;
}

describe("resolveAIConfig", () => {
	test("reads the key from OPENROUTER_API_KEY and falls back to the default model", () => {
		const dir = configDirWith();
		withEnv({ OF_CONFIG_DIR: dir, OPENROUTER_API_KEY: "sk-env", OF_AI_MODEL: undefined }, () => {
			const config = resolveAIConfig();
			expect(config.apiKey).toBe("sk-env");
			expect(config.model).toBe(DEFAULT_MODEL);
			expect(config.referer).toContain("github.com");
			expect(config.title).toBe("omnifocus-cli");
		});
	});

	test("reads key and model from the config file when the env is unset", () => {
		const dir = configDirWith(
			JSON.stringify({ ai: { apiKey: "sk-file", model: "openai/gpt-4.1-mini" } }),
		);
		withEnv({ OF_CONFIG_DIR: dir, OPENROUTER_API_KEY: undefined, OF_AI_MODEL: undefined }, () => {
			const config = resolveAIConfig();
			expect(config.apiKey).toBe("sk-file");
			expect(config.model).toBe("openai/gpt-4.1-mini");
		});
	});

	test("model precedence is flag > env > file > default", () => {
		const dir = configDirWith(JSON.stringify({ ai: { apiKey: "k", model: "file/model" } }));
		withEnv({ OF_CONFIG_DIR: dir, OPENROUTER_API_KEY: undefined, OF_AI_MODEL: "env/model" }, () => {
			expect(resolveAIConfig({ model: "flag/model" }).model).toBe("flag/model");
			expect(resolveAIConfig().model).toBe("env/model");
			expect(resolveAIModel()).toBe("env/model");
		});
		withEnv({ OF_CONFIG_DIR: dir, OPENROUTER_API_KEY: undefined, OF_AI_MODEL: undefined }, () => {
			expect(resolveAIConfig().model).toBe("file/model");
		});
	});

	test("env key wins over the file key", () => {
		const dir = configDirWith(JSON.stringify({ ai: { apiKey: "sk-file" } }));
		withEnv({ OF_CONFIG_DIR: dir, OPENROUTER_API_KEY: "sk-env" }, () => {
			expect(resolveAIConfig().apiKey).toBe("sk-env");
		});
	});

	test("a missing key throws an AIError naming the env var and config path", () => {
		const dir = configDirWith();
		withEnv({ OF_CONFIG_DIR: dir, OPENROUTER_API_KEY: undefined }, () => {
			let caught: unknown;
			try {
				resolveAIConfig();
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(AIError);
			expect((caught as AIError).kind).toBe("missing-key");
			expect((caught as AIError).message).toContain("OPENROUTER_API_KEY");
			expect((caught as AIError).message).toContain(join(dir, "config.json"));
			expect(configPath()).toBe(join(dir, "config.json"));
			expect(describeAISetup()).toContain("--model");
		});
	});

	test("a malformed or oddly shaped config file is ignored, not fatal", () => {
		for (const content of ["{not json", '{"ai": "nope"}', '{"ai": {"apiKey": 42}}', "[]"]) {
			const dir = configDirWith(content);
			withEnv({ OF_CONFIG_DIR: dir, OPENROUTER_API_KEY: "sk-env", OF_AI_MODEL: undefined }, () => {
				expect(resolveAIConfig().model).toBe(DEFAULT_MODEL);
				expect(resolveAIModel()).toBe(DEFAULT_MODEL);
			});
		}
	});
});
