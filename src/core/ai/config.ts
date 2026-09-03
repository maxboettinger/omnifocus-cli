/**
 * AI configuration: which model to talk to and with which key.
 *
 * Precedence follows the convention of mature AI CLIs (flag > environment >
 * config file > built-in default):
 *
 *   model:  --model  >  $OF_AI_MODEL  >  config.json ai.model  >  DEFAULT_MODEL
 *   key:    $OPENROUTER_API_KEY  >  config.json ai.apiKey
 *
 * The config file is `$OF_CONFIG_DIR/config.json` (test seam) or
 * `$XDG_CONFIG_HOME/omnifocus-cli/config.json`, defaulting to
 * `~/.config/omnifocus-cli/config.json`. It is optional and read
 * best-effort: a missing or malformed file is treated as empty.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AIError } from "./types.js";

/** Cheap, fast, and supports strict JSON-schema output through OpenRouter. */
export const DEFAULT_MODEL = "google/gemini-2.5-flash";
export const APP_REFERER = "https://github.com/maxboettinger/omnifocus-cli";
export const APP_TITLE = "omnifocus-cli";

export interface AIConfig {
	apiKey: string;
	model: string;
	/** Sent as HTTP-Referer for OpenRouter app attribution. */
	referer: string;
	/** Sent as X-OpenRouter-Title for OpenRouter app attribution. */
	title: string;
}

export interface AIConfigOverrides {
	model?: string;
}

interface FileConfig {
	apiKey?: string;
	model?: string;
}

/** `$OF_CONFIG_DIR` (test seam) or `$XDG_CONFIG_HOME`/`~/.config` + `omnifocus-cli`. */
export function configDir(): string {
	const override = process.env.OF_CONFIG_DIR;
	if (override) return override;
	const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(configHome, "omnifocus-cli");
}

export function configPath(): string {
	return join(configDir(), "config.json");
}

function readFileConfig(): FileConfig {
	try {
		const parsed: unknown = JSON.parse(readFileSync(configPath(), "utf8"));
		if (typeof parsed !== "object" || parsed === null) return {};
		const ai = (parsed as { ai?: unknown }).ai;
		if (typeof ai !== "object" || ai === null) return {};
		const { apiKey, model } = ai as Record<string, unknown>;
		return {
			apiKey: typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : undefined,
			model: typeof model === "string" && model.trim() ? model.trim() : undefined,
		};
	} catch {
		return {};
	}
}

/** How to configure the AI features — used in the missing-key error and docs. */
export function describeAISetup(): string {
	return [
		"AI commands need an OpenRouter API key (https://openrouter.ai/keys).",
		"Set it with `export OPENROUTER_API_KEY=sk-or-...`, or store it in",
		`${configPath()} as {"ai": {"apiKey": "sk-or-...", "model": "${DEFAULT_MODEL}"}}.`,
		"Pick a model per run with --model <id>, or globally with $OF_AI_MODEL.",
	].join("\n");
}

/** Resolve the model without requiring a key (for help text and previews). */
export function resolveAIModel(overrides: AIConfigOverrides = {}): string {
	return overrides.model || process.env.OF_AI_MODEL || readFileConfig().model || DEFAULT_MODEL;
}

/** Resolve the full config; throws `AIError("missing-key")` when no key is configured. */
export function resolveAIConfig(overrides: AIConfigOverrides = {}): AIConfig {
	const file = readFileConfig();
	const apiKey = process.env.OPENROUTER_API_KEY || file.apiKey;
	if (!apiKey) throw new AIError("missing-key", describeAISetup());
	return {
		apiKey,
		model: overrides.model || process.env.OF_AI_MODEL || file.model || DEFAULT_MODEL,
		referer: APP_REFERER,
		title: APP_TITLE,
	};
}
