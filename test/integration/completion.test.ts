/**
 * Completion script tests — the scripts are generated from the live
 * Commander program, so every registered command must appear in every
 * shell's script. Guards against the drift that once dropped
 * `task delete` and `collect` from the completions.
 */

import { describe, expect, test } from "bun:test";
import type { Command } from "commander";
import { generateCompletionScript } from "../../src/commands/completion.js";
import { buildProgram } from "../../src/program.js";
import { createMockClient } from "../fixtures/mock-client.js";

const SHELLS = ["bash", "zsh", "fish"] as const;

function collectCommandNames(cmd: Command, depth = 0): string[] {
	const names: string[] = [];
	for (const sub of cmd.commands) {
		names.push(sub.name());
		if (depth < 2) names.push(...collectCommandNames(sub, depth + 1));
	}
	return names;
}

describe("completion script generation", () => {
	const program = buildProgram(createMockClient());

	for (const shell of SHELLS) {
		test(`${shell} script mentions every registered command`, () => {
			const script = generateCompletionScript(program, shell);
			for (const name of new Set(collectCommandNames(program))) {
				expect(script).toContain(name);
			}
		});
	}

	test("bash task verbs include delete (regression)", () => {
		const script = generateCompletionScript(program, "bash");
		const taskVerbs = /task_verbs="([^"]*)"/.exec(script);
		expect(taskVerbs?.[1]?.split(" ")).toContain("delete");
	});

	test("bash top-level nouns include collect (regression)", () => {
		const script = generateCompletionScript(program, "bash");
		const nouns = /nouns="([^"]*)"/.exec(script);
		expect(nouns?.[1]?.split(" ")).toContain("collect");
	});

	test("zsh task subcommands include delete (regression)", () => {
		const script = generateCompletionScript(program, "zsh");
		const block = /task_cmds=\(([\s\S]*?)\)/.exec(script);
		expect(block?.[1]).toContain("'delete:");
	});

	test("fish task subcommands include delete (regression)", () => {
		const script = generateCompletionScript(program, "fish");
		expect(script).toContain("'__fish_seen_subcommand_from task t' -a delete");
	});

	test("unknown shell throws", () => {
		expect(() => generateCompletionScript(program, "powershell")).toThrow();
	});

	test("bash offers noun aliases and matches them in verb cases", () => {
		const script = generateCompletionScript(program, "bash");
		const nouns = /nouns="([^"]*)"/.exec(script)?.[1]?.split(" ") ?? [];
		for (const alias of ["t", "p", "g", "f", "i", "b"]) expect(nouns).toContain(alias);
		expect(script).toContain("task|t) COMPREPLY=");
	});

	test("zsh describes aliases and matches them in verb cases", () => {
		const script = generateCompletionScript(program, "zsh");
		expect(script).toContain("'t:Manage tasks'");
		expect(script).toContain("task|t) _describe");
	});

	test("fish offers aliases at top level and in subcommand guards", () => {
		const script = generateCompletionScript(program, "fish");
		expect(script).toContain("-n __fish_use_subcommand -a t -d 'Manage tasks'");
		expect(script).toContain("'__fish_seen_subcommand_from task t' -a list");
	});
});
