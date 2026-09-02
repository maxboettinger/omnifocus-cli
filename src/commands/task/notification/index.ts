import { defineNoun } from "../../noun.js";
import { registerAddCommand } from "./add.js";
import { registerClearCommand } from "./clear.js";
import { registerDeleteCommand } from "./delete.js";
import { registerListCommand } from "./list.js";
import { registerUpdateCommand } from "./update.js";

export const registerNotificationCommands = defineNoun({
	name: "notification",
	description: "Manage task notifications",
	verbs: [
		registerListCommand,
		registerAddCommand,
		registerUpdateCommand,
		registerDeleteCommand,
		registerClearCommand,
	],
});
