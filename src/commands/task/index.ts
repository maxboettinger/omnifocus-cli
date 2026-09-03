import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerCompleteCommand } from "./complete.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerMoveCommand } from "./move.js";
import { registerNotificationCommands } from "./notification/index.js";
import { registerSearchCommand } from "./search.js";
import { registerShowCommand } from "./show.js";
import { registerTagCommand } from "./tag.js";
import { registerUpdateCommand } from "./update.js";

export const registerTaskCommands = defineNoun({
	name: "task",
	alias: "t",
	description: "Manage tasks",
	verbs: [
		registerAddCommand,
		registerListCommand,
		registerShowCommand,
		registerSearchCommand,
		registerUpdateCommand,
		registerMoveCommand,
		registerCompleteCommand,
		registerTagCommand,
		registerDeleteCommand,
		registerNotificationCommands,
	],
	verbAliases: {
		add: "a",
		list: "l",
		show: "s",
		search: "f",
		update: "u",
		move: "m",
		complete: "c",
		tag: "g",
		delete: "d",
		notification: "n",
	},
});
