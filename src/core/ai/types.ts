/**
 * The AI seam: the narrow LLM interface every command can depend on.
 *
 * Mirrors the OmniFocus side of the architecture — `OmniFocusClient` is
 * the seam for Apple Events, `AIClient` is the seam for the language
 * model. Commands receive an `AIClient` through registration and never
 * import the OpenRouter SDK; tests inject a scripted fake.
 */

import { CLIError } from "../errors.js";

export type Role = "system" | "user" | "assistant";

export interface Message {
	role: Role;
	content: string;
}

export interface ChatRequest {
	/** Full conversation; the system prompt is `messages[0]`. */
	messages: Message[];
	/** Model id; resolved from config when absent. */
	model?: string;
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
}

export interface ChatUsage {
	prompt: number;
	completion: number;
}

export interface ChatResult {
	content: string;
	/** The model that actually answered (OpenRouter may route). */
	model: string;
	usage?: ChatUsage;
}

export interface ValidationFailure {
	errors: string[];
}

export function isValidationFailure(value: unknown): value is ValidationFailure {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as ValidationFailure).errors)
	);
}

/** A JSON-schema-constrained response type plus its runtime validator. */
export interface StructuredSchema<T> {
	name: string;
	schema: Record<string, unknown>;
	validate(raw: unknown): { value: T } | ValidationFailure;
}

export interface StructuredResult<T> {
	value: T;
	/** The exact JSON text the model returned (kept for conversation history). */
	raw: string;
	model: string;
	/** 1 on first-try success, 2 when the validation-repair retry was needed. */
	attempts: number;
}

export interface AIClient {
	chat(req: ChatRequest): Promise<ChatResult>;
	stream(req: ChatRequest, onDelta: (text: string) => void): Promise<ChatResult>;
	structured<T>(req: ChatRequest, schema: StructuredSchema<T>): Promise<StructuredResult<T>>;
}

export type AIErrorKind =
	| "missing-key"
	| "auth"
	| "credits"
	| "rate-limit"
	| "bad-request"
	| "invalid-response"
	| "network"
	| "aborted";

/** Any failure talking to the model, with a kind the caller can branch on. */
export class AIError extends CLIError {
	readonly kind: AIErrorKind;

	constructor(kind: AIErrorKind, message: string) {
		super(message);
		this.name = "AIError";
		this.kind = kind;
	}
}
