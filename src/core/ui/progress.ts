/**
 * Progress indication for OmniFocus round-trips.
 *
 * Every client method is an `osascript` round-trip that takes a second or
 * more, so the CLI shows a spinner on stderr while one is in flight. This
 * module implements that as a decorator over `OmniFocusClient`: commands
 * stay thin and unaware, and the wiring happens once at the entry point.
 *
 * Two independent gates must both be open before anything is drawn:
 *
 * 1. `setProgressEnabled(true)` — flipped by the program's preAction hook
 *    only when the resolved output format is human. Off by default, so a
 *    JSON run (`--json`, piped stdout, agent harnesses) can never show
 *    chrome even if a gate elsewhere is forgotten.
 * 2. `isInteractive(stream)` — the stream is a real terminal, not CI or a
 *    dumb terminal.
 *
 * The spinner library is imported lazily, on the first render only, so the
 * JSON path never evaluates it: no stream hooking, no signal handlers, no
 * timers.
 */

import type { Writable } from "node:stream";
import type { OmniFocusClient } from "../types.js";
import { type TerminalStream, isInteractive } from "./terminal.js";

/** Minimal shape yocto-spinner needs from a stream (a TTY WriteStream satisfies it). */
export interface ProgressStream extends TerminalStream {
	write(chunk: string): boolean;
	columns?: number;
	cursorTo?(x: number, y?: number): boolean;
	moveCursor?(dx: number, dy: number): boolean;
	clearLine?(dir: -1 | 0 | 1): boolean;
}

export type ProgressLabels = Partial<Record<keyof OmniFocusClient, string>>;

export interface ProgressOptions {
	/** Stream to draw on. Defaults to stderr so stdout stays clean data. */
	stream?: ProgressStream;
	/** Per-op labels; merged over the built-in defaults. */
	labels?: ProgressLabels;
}

export const DEFAULT_PROGRESS_LABEL = "Talking to OmniFocus…";

/** Labels for ops whose wait is long enough to deserve a specific message. */
export const PROGRESS_LABELS: ProgressLabels = {
	forecast: "Building forecast…",
	review: "Gathering projects for review…",
	stats: "Computing statistics…",
	collectCompleted: "Collecting completed tasks…",
	bulkCreate: "Creating tasks…",
	bulkUpdate: "Updating tasks…",
	bulkComplete: "Completing tasks…",
	listTasks: "Loading tasks…",
	searchTasks: "Searching tasks…",
	listInbox: "Loading inbox…",
	listProjects: "Loading projects…",
	listTags: "Loading tags…",
	listFolders: "Loading folders…",
	listTasksByTag: "Loading tagged tasks…",
	getTaskContext: "Gathering task context…",
	createTaskTree: "Creating subtasks…",
};

let progressEnabled = false;

/** Allow progress chrome. Called by the program once it knows output is human-mode. */
export function setProgressEnabled(enabled: boolean): void {
	progressEnabled = enabled;
}

export function isProgressEnabled(): boolean {
	return progressEnabled;
}

interface ActiveSpinner {
	stop(): unknown;
}

async function startSpinner(text: string, stream: ProgressStream): Promise<ActiveSpinner> {
	// Lazy: the JSON path must never pay for (or be affected by) this module.
	const { default: yoctoSpinner } = await import("yocto-spinner");
	return yoctoSpinner({ text, stream: stream as unknown as Writable }).start();
}

/**
 * Run `fn` with a spinner showing `label` while it is in flight, when both
 * gates allow it; otherwise just run it. The spinner is cleared (never
 * persisted) on both success and failure — the caller's own output or error
 * is the result the user should see. This is the one primitive behind
 * `withProgress` and behind any other long wait (e.g. a model call).
 */
export async function withSpinner<T>(
	label: string,
	fn: () => Promise<T>,
	stream: ProgressStream = process.stderr,
): Promise<T> {
	if (!progressEnabled || !isInteractive(stream)) return fn();
	const spinner = await startSpinner(label, stream);
	try {
		return await fn();
	} finally {
		spinner.stop();
	}
}

/** Wrap a client so every method shows a spinner while it runs, when allowed. */
export function withProgress(client: OmniFocusClient, opts: ProgressOptions = {}): OmniFocusClient {
	const stream = opts.stream ?? process.stderr;
	const labels: ProgressLabels = { ...PROGRESS_LABELS, ...opts.labels };

	return new Proxy(client, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value !== "function") return value;
			const method = value as (...args: unknown[]) => Promise<unknown>;
			const label = labels[prop as keyof OmniFocusClient] ?? DEFAULT_PROGRESS_LABEL;
			return (...args: unknown[]) => withSpinner(label, () => method.apply(target, args), stream);
		},
	});
}
