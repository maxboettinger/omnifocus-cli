/**
 * The one noun registrar. A noun (`task`, `project`, ...) is a Commander
 * subcommand carrying a stable one-letter alias and a list of verb
 * register functions. Each noun's index.ts is a NounSpec literal and
 * nothing else; nested nouns (task notification) use the same mechanism
 * without an alias.
 *
 * Verb aliases are declared here too, per mount point rather than inside
 * the verb file: a verb file can be mounted under several nouns (`task add`
 * is also `inbox add`), and a letter only has to be unique among the verbs
 * of one noun. `defineNoun` validates that invariant at build time so a
 * collision fails the test suite instead of silently shadowing a verb.
 */

import type { Command } from "commander";
import type { AIClient } from "../core/ai/types.js";
import type { OmniFocusClient } from "../core/types.js";

/**
 * A verb (or nested noun) registrar. Both clients are always passed; a verb
 * that needs no model simply declares two parameters and ignores the third.
 */
export type Register = (parent: Command, client: OmniFocusClient, ai: AIClient) => void;

export interface NounSpec {
	name: string;
	/** One stable letter, top-level nouns only. */
	alias?: string;
	description: string;
	verbs: readonly Register[];
	/**
	 * Verb name → one stable letter, applied after the verbs are mounted
	 * (`{ complete: "c" }` makes `of t c 42` work). A nested noun counts as
	 * a verb of its parent, so `{ notification: "n" }` belongs here as well.
	 */
	verbAliases?: Readonly<Record<string, string>>;
}

export function defineNoun(spec: NounSpec): Register {
	return (parent, client, ai) => {
		const cmd = parent.command(spec.name).description(spec.description);
		if (spec.alias) cmd.alias(spec.alias);
		for (const register of spec.verbs) register(cmd, client, ai);
		applyVerbAliases(cmd, spec.verbAliases ?? {});
	};
}

function applyVerbAliases(noun: Command, verbAliases: Readonly<Record<string, string>>): void {
	const taken = new Map<string, string>();
	for (const verb of noun.commands) {
		for (const spelling of [verb.name(), ...verb.aliases()]) taken.set(spelling, verb.name());
	}
	for (const [verbName, alias] of Object.entries(verbAliases)) {
		const verb = noun.commands.find((c) => c.name() === verbName);
		if (!verb) {
			throw new Error(`${noun.name()}: verb alias "${alias}" names unknown verb "${verbName}"`);
		}
		if (alias.length !== 1) {
			throw new Error(`${noun.name()} ${verbName}: verb alias "${alias}" must be one character`);
		}
		const owner = taken.get(alias);
		if (owner) {
			throw new Error(
				`${noun.name()} ${verbName}: verb alias "${alias}" collides with verb "${owner}"`,
			);
		}
		taken.set(alias, verbName);
		verb.alias(alias);
	}
}
