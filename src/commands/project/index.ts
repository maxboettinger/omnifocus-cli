import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerRenameCommand } from "./rename.js";
import { registerShowCommand } from "./show.js";
import { registerUpdateCommand } from "./update.js";

export const registerProjectCommands = defineNoun({
	name: "project",
	alias: "p",
	description: "Manage projects",
	verbs: [
		registerAddCommand,
		registerListCommand,
		registerShowCommand,
		registerUpdateCommand,
		registerRenameCommand,
		registerDeleteCommand,
	],
});
