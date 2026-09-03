/**
 * A growing message list for multi-turn verbs. Every request carries the
 * whole history (system prompt first), which is what lets the model adapt
 * its next question or revise its previous plan.
 */

import type { Message } from "./types.js";

export class Conversation {
	private readonly log: Message[];

	constructor(system: string) {
		this.log = [{ role: "system", content: system }];
	}

	user(content: string): this {
		this.log.push({ role: "user", content });
		return this;
	}

	assistant(content: string): this {
		this.log.push({ role: "assistant", content });
		return this;
	}

	/** A copy — callers may not mutate the history behind the conversation's back. */
	get messages(): Message[] {
		return [...this.log];
	}

	/** Number of user turns so far (the opening context message included). */
	get userTurns(): number {
		return this.log.filter((m) => m.role === "user").length;
	}
}
