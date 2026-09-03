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

	function mountVerbs(names: string[]) {
		return names.map((n) => (parent: Command) => {
			parent.command(n);
		});
	}

	function build(spec: Parameters<typeof defineNoun>[0]): Command {
		const program = new Command();
		defineNoun(spec)(program, createMockClient());
		return program.commands[0] as Command;
	}

	describe("verbAliases", () => {
		test("applies one-letter aliases to the named verbs by mount point", () => {
			const noun = build({
				name: "widget",
				description: "d",
				verbs: mountVerbs(["add", "list", "complete"]),
				verbAliases: { add: "a", complete: "c" },
			});
			const aliases = Object.fromEntries(noun.commands.map((c) => [c.name(), c.aliases()]));
			expect(aliases).toEqual({ add: ["a"], list: [], complete: ["c"] });
		});

		test("rejects an alias for a verb the noun does not mount", () => {
			expect(() =>
				build({
					name: "widget",
					description: "d",
					verbs: mountVerbs(["add"]),
					verbAliases: { complete: "c" },
				}),
			).toThrow(/complete/);
		});

		test("rejects aliases longer than one character", () => {
			expect(() =>
				build({
					name: "widget",
					description: "d",
					verbs: mountVerbs(["add"]),
					verbAliases: { add: "ad" },
				}),
			).toThrow(/one character/);
		});

		test("rejects an alias that collides with another verb's name or alias", () => {
			expect(() =>
				build({
					name: "widget",
					description: "d",
					verbs: mountVerbs(["add", "a"]),
					verbAliases: { add: "a" },
				}),
			).toThrow(/collides/);
			expect(() =>
				build({
					name: "widget",
					description: "d",
					verbs: mountVerbs(["add", "archive"]),
					verbAliases: { add: "a", archive: "a" },
				}),
			).toThrow(/collides/);
		});
	});
});
