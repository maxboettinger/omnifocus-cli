import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerRenameCommand } from "./rename.js";
import { registerTasksCommand } from "./tasks.js";

export const registerTagCommands = defineNoun({
	name: "tag",
	alias: "g",
	description: "Manage tags",
	verbs: [
		registerAddCommand,
		registerListCommand,
		registerTasksCommand,
		registerRenameCommand,
		registerDeleteCommand,
	],
	verbAliases: {
		add: "a",
		list: "l",
		tasks: "t",
		rename: "r",
		delete: "d",
	},
});
