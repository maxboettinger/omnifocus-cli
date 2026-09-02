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
	try {
		return fn();
	} finally {
		if (original) Object.defineProperty(stream, "isTTY", original);
		else Reflect.deleteProperty(stream, "isTTY");
	}
}
