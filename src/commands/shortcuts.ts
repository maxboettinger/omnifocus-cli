/**
 * Root-level shortcuts for the most common task verbs.
 *
 * `of complete 42` is the same command as `of task complete 42`: the verb's
 * own `register*Command` is simply mounted on the root program as well, so
 * there is exactly one implementation, one set of options and one set of
 * tests. Shell completions pick the shortcut up from the live command tree.
 *
 * To add another shortcut (e.g. `of edit`), append its register function
 * to TASK_SHORTCUTS — nothing else needs to change.
 */

import type { Command } from "commander";
import type { OmniFocusClient } from "../core/types.js";
import { registerCompleteCommand } from "./task/complete.js";
import { registerMoveCommand } from "./task/move.js";

type Register = (parent: Command, client: OmniFocusClient) => void;

const TASK_SHORTCUTS: readonly Register[] = [registerCompleteCommand, registerMoveCommand];

export function registerShortcutCommands(program: Command, client: OmniFocusClient): void {
	for (const register of TASK_SHORTCUTS) register(program, client);
}
