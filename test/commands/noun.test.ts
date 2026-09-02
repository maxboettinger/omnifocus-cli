import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { defineNoun } from "../../src/commands/noun.js";
import { createMockClient } from "../fixtures/mock-client.js";

describe("defineNoun", () => {
	test("mounts the noun with alias and description, then every verb under it", () => {
		const seen: string[] = [];
		const register = defineNoun({
			name: "widget",
			alias: "w",
			description: "Manage widgets",
			verbs: [
				(parent) => {
					seen.push(parent.name());
					parent.command("list");
				},
			],
		});
		const program = new Command();
		register(program, createMockClient());
		const noun = program.commands.find((c) => c.name() === "widget");
		expect(noun?.aliases()).toEqual(["w"]);
		expect(noun?.description()).toBe("Manage widgets");
		expect(noun?.commands.map((c) => c.name())).toEqual(["list"]);
		expect(seen).toEqual(["widget"]);
	});

	test("nested nouns need no alias", () => {
		const program = new Command();
		defineNoun({ name: "inner", description: "d", verbs: [] })(program, createMockClient());
		expect(program.commands[0]?.aliases()).toEqual([]);
	});
});
