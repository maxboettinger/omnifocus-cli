/**
 * Test harness for src/jxa/bridge.js.
 *
 * The bridge is plain pre-ES6 JavaScript whose only environmental dependency
 * is the JXA `Application` global. Evaluating the script with a stubbed
 * `Application` lets us exercise the real op handlers without OmniFocus.
 *
 * JXA object references are callable specifiers: `doc.inboxTasks` is an
 * object with batch property getters (`.name()` returns an array of names)
 * that can also be invoked (`doc.inboxTasks()` returns the element array).
 * `makeElementArray` reproduces that shape.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const bridgeSource = readFileSync(join(import.meta.dir, "../../src/jxa/bridge.js"), "utf8")
	// strip the osascript shebang — invalid syntax inside new Function
	.replace(/^#![^\n]*\n/, "");

export interface BridgeResponse {
	ok: boolean;
	data?: unknown;
	error?: string;
	candidates?: unknown[];
}

type JxaValue = unknown;

/** A JXA element array: callable (returns elements) with batch property getters. */
export function makeElementArray(elements: Array<Record<string, JxaValue>>): CallableFunction {
	const specifier = (() => elements.map(makeJxaObject)) as CallableFunction;
	const keys = new Set(elements.flatMap((e) => Object.keys(e)));
	for (const key of keys) {
		// defineProperty: plain assignment fails for readonly Function props like `name`
		Object.defineProperty(specifier, key, {
			value: () => elements.map((e) => e[key] ?? null),
		});
	}
	return specifier;
}

/** A single JXA object: every property becomes a zero-arg getter method. */
export function makeJxaObject(props: Record<string, JxaValue>): Record<string, () => JxaValue> {
	const obj: Record<string, () => JxaValue> = {};
	for (const [key, value] of Object.entries(props)) {
		obj[key] = () => value;
	}
	return obj;
}

/**
 * Evaluate bridge.js against a fake OmniFocus document and dispatch one command.
 * Returns the parsed JSON response the bridge would print.
 */
export function runBridge(
	doc: Record<string, unknown>,
	op: string,
	params: Record<string, unknown> = {},
): BridgeResponse {
	return runBridgeArgs(doc, [JSON.stringify({ op, params })]);
}

/**
 * Like runBridge, but with raw argv control and optional stdin content —
 * used to exercise the "@stdin" command-passing path. `stdinContent: null`
 * simulates stdin bytes that cannot be decoded as UTF-8 (NSString init
 * returns nil, which ObjC.unwrap turns into undefined).
 */
export function runBridgeArgs(
	doc: Record<string, unknown>,
	args: string[],
	stdinContent?: string | null,
	opts?: { applicationUnavailable?: boolean },
): BridgeResponse {
	const app = {
		includeStandardAdditions: false,
		defaultDocument: doc,
		delete: () => undefined,
	};
	const Application = (name: string) => {
		// Simulates JXA's behavior when the app is not installed
		if (opts?.applicationUnavailable) throw new Error("Application can't be found.");
		if (name !== "OmniFocus") throw new Error(`Unexpected Application: ${name}`);
		return app;
	};
	const dataBlob = { __content: stdinContent };
	const objcStub = {
		import: () => undefined,
		unwrap: (s: { js?: unknown } | undefined) => s?.js,
	};
	const dollarStub = {
		NSFileHandle: { fileHandleWithStandardInput: { readDataToEndOfFile: dataBlob } },
		NSString: {
			alloc: {
				initWithDataEncoding: (d: { __content?: string | null }, _enc: unknown) =>
					d.__content == null ? undefined : { js: d.__content },
			},
		},
		NSUTF8StringEncoding: 4,
	};
	const evaluate = new Function("Application", "ObjC", "$", `${bridgeSource}\nreturn run;`);
	const run = evaluate(Application, objcStub, dollarStub) as (args: string[]) => string;
	return JSON.parse(run(args)) as BridgeResponse;
}
