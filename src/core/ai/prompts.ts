/**
 * System prompts are plain Markdown files, one per feature, in `src/prompts/`.
 *
 * They are embedded with Bun text imports so the compiled binary carries
 * them (and `bun run dev` picks up edits on the next run), and any of them
 * can be overridden at runtime without rebuilding by dropping a file of the
 * same name into `$OF_PROMPTS_DIR` or `~/.config/omnifocus-cli/prompts/`.
 * The override wins whenever it exists and is not blank.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import breakdownPrompt from "../../prompts/breakdown.md" with { type: "text" };
import whyPrompt from "../../prompts/why.md" with { type: "text" };
import { configDir } from "./config.js";

export type PromptName = "why" | "breakdown";

const EMBEDDED: Record<PromptName, string> = {
	why: whyPrompt,
	breakdown: breakdownPrompt,
};

export const PROMPT_NAMES: readonly PromptName[] = ["why", "breakdown"];

export interface LoadedPrompt {
	text: string;
	source: "override" | "embedded";
	/** The override file that was used, when `source` is "override". */
	path?: string;
}

/** `$OF_PROMPTS_DIR` (test seam / power users) or `<config dir>/prompts`. */
export function promptsDir(): string {
	return process.env.OF_PROMPTS_DIR || join(configDir(), "prompts");
}

export function loadPrompt(name: PromptName): LoadedPrompt {
	const overridePath = join(promptsDir(), `${name}.md`);
	try {
		const text = readFileSync(overridePath, "utf8");
		if (text.trim()) return { text, source: "override", path: overridePath };
	} catch {
		// No override — fall through to the embedded prompt.
	}
	return { text: EMBEDDED[name], source: "embedded" };
}
