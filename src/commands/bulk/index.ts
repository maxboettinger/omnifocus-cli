import { defineNoun } from "../noun.js";
import { registerBulkCompleteCommand } from "./complete.js";
import { registerBulkCreateCommand } from "./create.js";
import { registerBulkUpdateCommand } from "./update.js";

export const registerBulkCommands = defineNoun({
	name: "bulk",
	alias: "b",
	description: "Bulk operations from stdin JSON",
	verbs: [registerBulkCreateCommand, registerBulkUpdateCommand, registerBulkCompleteCommand],
});
