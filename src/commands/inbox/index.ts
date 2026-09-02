import { defineNoun } from "../noun.js";
import { registerAddCommand } from "./add.js";
import { registerListCommand } from "./list.js";
import { registerProcessManyCommand } from "./process-many.js";
import { registerProcessCommand } from "./process.js";

export const registerInboxCommands = defineNoun({
	name: "inbox",
	alias: "i",
	description: "Manage the inbox",
	verbs: [
		registerListCommand,
		registerAddCommand,
		registerProcessCommand,
		registerProcessManyCommand,
	],
});
