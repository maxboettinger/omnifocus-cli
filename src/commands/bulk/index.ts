import { defineNoun } from "../noun.js";
import { registerBulkAddCommand } from "./add.js";
import { registerBulkCompleteCommand } from "./complete.js";
import { registerBulkUpdateCommand } from "./update.js";

export const registerBulkCommands = defineNoun({
	name: "bulk",
	alias: "b",
	description: "Bulk operations from stdin JSON",
	verbs: [registerBulkAddCommand, registerBulkUpdateCommand, registerBulkCompleteCommand],
	verbAliases: {
		add: "a",
		update: "u",
		complete: "c",
	},
});
