/**
 * Shared helpers for tests that depend on environment variables or a
 * stream's TTY state. Every helper restores the original state in a
 * `finally` block so tests cannot leak configuration into each other.
 */

/**
 * Run `fn` with the given env vars set (`undefined` = unset), then restore.
 * If `fn` returns a promise, restoration waits for it to settle.
 */
export function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
	const saved: Record<string, string | undefined> = {};
	for (const [key, value] of Object.entries(env)) {
		saved[key] = process.env[key];
		if (value === undefined) Reflect.deleteProperty(process.env, key);
		else process.env[key] = value;
	}
	const restore = () => {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) Reflect.deleteProperty(process.env, key);
			else process.env[key] = value;
		}
	};
	let result: T;
	try {
		result = fn();
	} catch (error) {
		restore();
		throw error;
	}
	if (result instanceof Promise) {
		return result.finally(restore) as T;
	}
	restore();
	return result;
}

/** Run `fn` with `stream.isTTY` forced to a value, then restore. */
export function withStreamTTY<T>(
	stream: NodeJS.WriteStream,
	isTTY: boolean | undefined,
	fn: () => T,
): T {
	const original = Object.getOwnPropertyDescriptor(stream, "isTTY");
	Object.defineProperty(stream, "isTTY", { value: isTTY, configurable: true });
	const restore = () => {
		if (original) Object.defineProperty(stream, "isTTY", original);
		else Reflect.deleteProperty(stream, "isTTY");
	};
	let result: T;
	try {
		result = fn();
	} catch (error) {
		restore();
		throw error;
	}
	if (result instanceof Promise) {
		return result.finally(restore) as T;
	}
	restore();
	return result;
}

/** Replace `process.stdin` (a Readable, or `{ isTTY: true }`) for the duration of `fn`. */
export async function withStdin<T>(value: unknown, fn: () => T | Promise<T>): Promise<T> {
	const original = process.stdin;
	Object.defineProperty(process, "stdin", { value, configurable: true });
	try {
		return await fn();
	} finally {
		Object.defineProperty(process, "stdin", { value: original, configurable: true });
	}
}

/**
 * Divert a stream's `write` into `sink` for the duration of `fn` — for code
 * that writes to `process.stdout`/`process.stderr` directly (streamed model
 * output, readline prompts) rather than through console.log/error.
 */
export async function withStreamWrite<T>(
	stream: NodeJS.WriteStream,
	sink: (chunk: string) => void,
	fn: () => T | Promise<T>,
): Promise<T> {
	const original = stream.write;
	stream.write = ((chunk: unknown) => {
		sink(String(chunk));
		return true;
	}) as typeof stream.write;
	try {
		return await fn();
	} finally {
		stream.write = original;
	}
}
