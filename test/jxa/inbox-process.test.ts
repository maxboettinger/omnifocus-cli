/**
 * Regression tests for ops["inbox.process"]'s delete branch in
 * src/jxa/bridge.js, run against a stubbed OmniFocus document via the
 * bridge harness.
 *
 * `inbox process --delete` used to call `of.delete(task)` unconditionally —
 * no confirmation was required at the bridge layer, mirroring the CLI-layer
 * gap fixed alongside this test. ops["task.delete"] already requires
 * `p.confirm`; this brings ops["inbox.process"] in line.
 */

import { describe, expect, test } from "bun:test";
import { makeElementArray, runBridge } from "./bridge-harness.js";

function makeDoc(tasks: Array<Record<string, unknown>>): Record<string, unknown> {
	return { inboxTasks: makeElementArray(tasks) };
}

describe("inbox.process delete", () => {
	test("delete: true without confirm returns an error and does not delete", () => {
		const doc = makeDoc([{ id: "inbox-1", name: "Buy milk" }]);

		const response = runBridge(doc, "inbox.process", { id: "inbox-1", delete: true });

		expect(response.ok).toBe(false);
		expect(response.error).toContain("confirm");
	});

	test("delete: true with confirm: true deletes and reports success", () => {
		const doc = makeDoc([{ id: "inbox-1", name: "Buy milk" }]);

		const response = runBridge(doc, "inbox.process", {
			id: "inbox-1",
			delete: true,
			confirm: true,
		});

		expect(response.ok).toBe(true);
		const data = response.data as { id: string; changes: string[]; name: string };
		expect(data.id).toBe("inbox-1");
		expect(data.changes).toEqual(["deleted"]);
		expect(data.name).toBe("Buy milk");
	});

	test("dryRun with delete: true does not require confirm", () => {
		const doc = makeDoc([{ id: "inbox-1", name: "Buy milk" }]);

		const response = runBridge(doc, "inbox.process", {
			id: "inbox-1",
			delete: true,
			dryRun: true,
		});

		expect(response.ok).toBe(true);
		const data = response.data as { dryRun: boolean; planned: string[] };
		expect(data.dryRun).toBe(true);
		expect(data.planned).toContain("DELETE");
	});
});
