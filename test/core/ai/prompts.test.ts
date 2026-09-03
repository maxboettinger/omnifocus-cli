import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROMPT_NAMES, loadPrompt, promptsDir } from "../../../src/core/ai/prompts.js";
import { withEnv } from "../../helpers/env.js";

describe("loadPrompt", () => {
	test("every prompt has a non-empty embedded default", () => {
		for (const name of PROMPT_NAMES) {
			const prompt = loadPrompt(name);
			expect(prompt.source).toBe("embedded");
			expect(prompt.text.length).toBeGreaterThan(200);
			expect(prompt.path).toBeUndefined();
		}
	});

	test("the why prompt asks one question per turn and the breakdown prompt demands JSON", () => {
		expect(loadPrompt("why").text).toMatch(/one question per turn/i);
		expect(loadPrompt("breakdown").text).toMatch(/JSON only/i);
	});

	test("an override file in OF_PROMPTS_DIR replaces the embedded prompt", () => {
		const dir = mkdtempSync(join(tmpdir(), "of-prompts-"));
		writeFileSync(join(dir, "why.md"), "# custom why\n");
		withEnv({ OF_PROMPTS_DIR: dir }, () => {
			expect(promptsDir()).toBe(dir);
			const prompt = loadPrompt("why");
			expect(prompt).toEqual({
				text: "# custom why\n",
				source: "override",
				path: join(dir, "why.md"),
			});
			// Only the overridden prompt changes.
			expect(loadPrompt("breakdown").source).toBe("embedded");
		});
	});

	test("a blank override is ignored", () => {
		const dir = mkdtempSync(join(tmpdir(), "of-prompts-"));
		writeFileSync(join(dir, "breakdown.md"), "  \n");
		withEnv({ OF_PROMPTS_DIR: dir }, () => {
			expect(loadPrompt("breakdown").source).toBe("embedded");
		});
	});

	test("defaults to <config dir>/prompts when OF_PROMPTS_DIR is unset", () => {
		const dir = mkdtempSync(join(tmpdir(), "of-config-"));
		mkdirSync(join(dir, "prompts"));
		writeFileSync(join(dir, "prompts", "why.md"), "from config dir");
		withEnv({ OF_PROMPTS_DIR: undefined, OF_CONFIG_DIR: dir }, () => {
			expect(loadPrompt("why").text).toBe("from config dir");
		});
	});
});
