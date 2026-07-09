import type { Command } from "commander";
import { CLIError } from "../core/errors.js";

/**
 * Shell completion scripts, generated from the live Commander program so
 * they can never drift from the actual command surface. Supports three
 * levels of nesting (noun → verb → sub-verb, e.g. `task notification add`).
 */

interface CommandNode {
	name: string;
	description: string;
	children: CommandNode[];
}

function toTree(cmd: Command, depth = 0): CommandNode[] {
	const nodes: CommandNode[] = [];
	for (const sub of cmd.commands) {
		nodes.push({
			name: sub.name(),
			description: sub.description(),
			children: depth < 2 ? toTree(sub, depth + 1) : [],
		});
	}
	return nodes;
}

/** Sanitize a command name for use in a shell variable name. */
function varName(...parts: string[]): string {
	return parts.join("_").replace(/[^a-zA-Z0-9_]/g, "_");
}

/** Strip characters that would break single-quoted shell strings. */
function escapeDescription(desc: string): string {
	return desc.replace(/['\\]/g, "");
}

// ── bash ────────────────────────────────────────────────────────────────────

function generateBash(tree: CommandNode[]): string {
	const nouns = tree.map((n) => n.name).join(" ");
	const verbVars: string[] = [];
	const verbCases: string[] = [];
	const nestedIfs: string[] = [];

	for (const noun of tree) {
		if (noun.children.length === 0) continue;
		const v = varName(noun.name, "verbs");
		verbVars.push(`\tlocal ${v}="${noun.children.map((c) => c.name).join(" ")}"`);
		verbCases.push(`\t\t\t\t${noun.name}) COMPREPLY=( $(compgen -W "\${${v}}" -- "\${cur}") ) ;;`);
		for (const verb of noun.children) {
			if (verb.children.length === 0) continue;
			const nv = varName(noun.name, verb.name, "verbs");
			verbVars.push(`\tlocal ${nv}="${verb.children.map((c) => c.name).join(" ")}"`);
			nestedIfs.push(
				`\t\t\tif [[ "\${words[1]}" == "${noun.name}" && "\${words[2]}" == "${verb.name}" ]]; then\n\t\t\t\tCOMPREPLY=( $(compgen -W "\${${nv}}" -- "\${cur}") )\n\t\t\tfi`,
			);
		}
	}

	return [
		"# bash completion for of (omnifocus-cli)",
		"_of_completion() {",
		"\tlocal cur prev words cword",
		"\t_init_completion || return",
		"",
		`\tlocal nouns="${nouns}"`,
		...verbVars,
		"",
		'\tcase "${cword}" in',
		'\t\t1) COMPREPLY=( $(compgen -W "${nouns}" -- "${cur}") ) ;;',
		"\t\t2)",
		'\t\t\tcase "${prev}" in',
		...verbCases,
		"\t\t\tesac",
		"\t\t\t;;",
		"\t\t3)",
		...nestedIfs,
		"\t\t\t;;",
		"\tesac",
		"}",
		"complete -F _of_completion of",
	].join("\n");
}

// ── zsh ─────────────────────────────────────────────────────────────────────

function generateZsh(tree: CommandNode[]): string {
	const nounItems = tree.map((n) => `\t\t'${n.name}:${escapeDescription(n.description)}'`);
	const cmdArrays: string[] = [];
	const verbCases: string[] = [];
	const nestedIfs: string[] = [];

	for (const noun of tree) {
		if (noun.children.length === 0) continue;
		const v = varName(noun.name, "cmds");
		cmdArrays.push(
			`\tlocal -a ${v}\n\t${v}=(\n${noun.children
				.map((c) => `\t\t'${c.name}:${escapeDescription(c.description)}'`)
				.join("\n")}\n\t)`,
		);
		verbCases.push(`\t\t\t\t${noun.name}) _describe 'subcommand' ${v} ;;`);
		for (const verb of noun.children) {
			if (verb.children.length === 0) continue;
			const nv = varName(noun.name, verb.name, "cmds");
			cmdArrays.push(
				`\tlocal -a ${nv}\n\t${nv}=(\n${verb.children
					.map((c) => `\t\t'${c.name}:${escapeDescription(c.description)}'`)
					.join("\n")}\n\t)`,
			);
			nestedIfs.push(
				`\t\t\tif [[ "\$words[2]" == "${noun.name}" && "\$words[3]" == "${verb.name}" ]]; then\n\t\t\t\t_describe 'subcommand' ${nv}\n\t\t\tfi`,
			);
		}
	}

	return [
		"#compdef of",
		"# zsh completion for of (omnifocus-cli)",
		"",
		"_of() {",
		"\tlocal -a nouns",
		"\tnouns=(",
		...nounItems,
		"\t)",
		"",
		...cmdArrays,
		"",
		"\t_arguments -C '1:noun:->noun' '2:verb:->verb' '*::args:->args'",
		"",
		'\tcase "$state" in',
		"\t\tnoun)   _describe 'command' nouns ;;",
		"\t\tverb)",
		'\t\t\tcase "$words[2]" in',
		...verbCases,
		"\t\t\tesac",
		"\t\t\t;;",
		"\t\targs)",
		...nestedIfs,
		"\t\t\t;;",
		"\tesac",
		"}",
		"",
		'_of "$@"',
	].join("\n");
}

// ── fish ────────────────────────────────────────────────────────────────────

function generateFish(tree: CommandNode[]): string {
	const lines: string[] = [
		"# fish completion for of (omnifocus-cli)",
		"",
		"# Disable file completions",
		"complete -c of -f",
		"",
	];

	const nestedFunctions: string[] = [];
	const nestedRules: string[] = [];

	for (const noun of tree) {
		for (const verb of noun.children) {
			if (verb.children.length === 0) continue;
			const fn = `__of_seen_${varName(noun.name, verb.name)}`;
			nestedFunctions.push(
				`# Detect exact nested context: of ${noun.name} ${verb.name} <verb>`,
				`function ${fn}`,
				"    set -l cmd (commandline -opc)",
				`    test (count $cmd) -ge 3; and test "$cmd[2]" = "${noun.name}"; and test "$cmd[3]" = "${verb.name}"`,
				"end",
				"",
			);
			for (const sub of verb.children) {
				nestedRules.push(
					`complete -c of -n '${fn}' -a ${sub.name} -d '${escapeDescription(sub.description)}'`,
				);
			}
		}
	}

	lines.push(...nestedFunctions);
	lines.push("# Top-level commands");
	for (const noun of tree) {
		lines.push(
			`complete -c of -n __fish_use_subcommand -a ${noun.name} -d '${escapeDescription(noun.description)}'`,
		);
	}

	for (const noun of tree) {
		if (noun.children.length === 0) continue;
		lines.push("", `# ${noun.name} subcommands`);
		for (const verb of noun.children) {
			lines.push(
				`complete -c of -n '__fish_seen_subcommand_from ${noun.name}' -a ${verb.name} -d '${escapeDescription(verb.description)}'`,
			);
		}
	}

	if (nestedRules.length > 0) {
		lines.push("", "# nested subcommands");
		lines.push(...nestedRules);
	}

	lines.push(
		"",
		"# Global options",
		"complete -c of -l json -d 'Output in JSON format'",
		"complete -c of -l help -d 'Show help'",
		"complete -c of -s V -l version -d 'Show version'",
	);

	return lines.join("\n");
}

// ── Public API ──────────────────────────────────────────────────────────────

const GENERATORS: Record<string, (tree: CommandNode[]) => string> = {
	bash: generateBash,
	zsh: generateZsh,
	fish: generateFish,
};

/**
 * Generate the completion script for a shell from the assembled program.
 * @throws CLIError for unsupported shells.
 */
export function generateCompletionScript(program: Command, shell: string): string {
	const generator = GENERATORS[shell];
	if (!generator) {
		throw new CLIError(`Unknown shell: ${shell}. Supported: ${Object.keys(GENERATORS).join(", ")}`);
	}
	return generator(toTree(program));
}

export function registerCompletionCommand(parent: Command): void {
	parent
		.command("completion")
		.description("Output shell completion script")
		.argument("<shell>", "Shell type (bash, zsh, fish)")
		.action((shell: string) => {
			console.log(generateCompletionScript(parent, shell));
		});
}
