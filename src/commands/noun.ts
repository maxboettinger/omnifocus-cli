/**
 * The one noun registrar. A noun (`task`, `project`, ...) is a Commander
 * subcommand carrying a stable one-letter alias and a list of verb
 * register functions. Each noun's index.ts is a NounSpec literal and
 * nothing else; nested nouns (task notification) use the same mechanism
 * without an alias.
 */

import type { Command } from "commander";
import type { OmniFocusClient } from "../core/types.js";

export type Register = (parent: Command, client: OmniFocusClient) => void;

export interface NounSpec {
	name: string;
	/** One stable letter, top-level nouns only. */
	alias?: string;
	description: string;
	verbs: readonly Register[];
}

export function defineNoun(spec: NounSpec): Register {
	return (parent, client) => {
		const cmd = parent.command(spec.name).description(spec.description);
		if (spec.alias) cmd.alias(spec.alias);
		for (const register of spec.verbs) register(cmd, client);
	};
}
