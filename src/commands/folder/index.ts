import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerListCommand } from "./list.js";

export const registerFolderCommands = defineNoun({
	name: "folder",
	alias: "f",
	description: "Manage folders",
	verbs: [registerAddCommand, registerListCommand],
	verbAliases: {
		add: "a",
		list: "l",
	},
});
