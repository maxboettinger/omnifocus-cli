#!/usr/bin/env bun
/**
 * Stand-in for /usr/bin/osascript in bridge transport tests (via the
 * OF_BRIDGE_BIN test seam). Echoes back how it was invoked: the last argv
 * entry and how many bytes arrived on stdin, in bridge response shape.
 */

export {}; // top-level await/for-await requires module context

// Failure mode: emit OF_STUB_STDERR on stderr and exit with OF_STUB_EXIT
if (process.env.OF_STUB_STDERR) {
	console.error(process.env.OF_STUB_STDERR);
	process.exit(Number(process.env.OF_STUB_EXIT ?? "1"));
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
	chunks.push(chunk as Buffer);
}
const stdin = Buffer.concat(chunks).toString("utf-8");
const lastArg = process.argv.at(-1) ?? "";

console.log(JSON.stringify({ ok: true, data: { lastArg, stdinLength: stdin.length } }));
