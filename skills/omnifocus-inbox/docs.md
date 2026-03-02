# Noridoc: omnifocus-inbox

Path: @/omnifocus-inbox

### Overview

This is a behavioral/protocol skill (no scripts of its own) that defines how an LLM agent should capture tasks into the OmniFocus inbox. It specifies the complete processing pipeline: parsing user input (brain dumps, single tasks, ideas, mixed-language text), applying the lifeOS taxonomy decorations, fixing phrasing for actionability, and routing to the appropriate script for execution. It is the "DOING" counterpart to `omnifocus-create`, which defines the "THINKING" about task structuring.

### How it fits into the larger codebase

```
                          ┌──────────────────────┐
                          │   omnifocus-create    │
                          │  (THINKING: how to    │
                          │   structure tasks)     │
                          └──────────┬─────────────┘
                                     │ routes to
                                     ▼
┌─────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ User input  │────▶│   omnifocus-inbox     │────▶│  omnifocus-tasks     │
│ (brain dump,│     │  (DOING: capture      │     │  (documentation)     │
│  task, idea)│     │   protocol & rules)   │     └──────────┬───────────┘
└─────────────┘     └──────────────────────┘                │
                              │ references                   │
                              ▼                              ▼
                    ┌──────────────────────┐     ┌──────────────────────┐
                    │ taxonomy-reference.md│     │  omnifocus/scripts/  │
                    │ (@/omnifocus/         │     │  add_task.js         │
                    │  references/)         │     │  add_subtask.js      │
                    └──────────────────────┘     └──────────┬───────────┘
                                                             │
                                                             ▼
                                                      OmniFocus.app via JXA
```

- **Upstream consumers**: `omnifocus-create` routes its final output here for actual capture. `omnifocus-forecast` routes quick-captures here. The `email` skill chains through `omnifocus-create` then here.
- **Downstream execution**: All task creation uses `@/omnifocus-tasks` documentation which references scripts in `@/omnifocus/scripts/` — `add_task.js` for tasks with full metadata, `add_inbox.js` for inbox-only capture, and `add_subtask.js` for hierarchical (parent/child) task structures.
- **Shared reference**: The taxonomy (emoji chains, tag tables, spoon costs, time buffers) lives in `@/omnifocus/references/taxonomy-reference.md` and is not duplicated here -- this skill references it.
- **Sibling skills**: `omnifocus-process` handles triage of items already in the inbox. `omnifocus-plan` handles estimation and prioritization. `calendar-blocking` consumes planned tasks. `omnifocus-projects` provides project discovery and management for routing tasks to specific projects. `omnifocus-tasks` provides comprehensive documentation for all task operations (CRUD, search, bulk).

### Core Implementation

The skill is defined entirely in `SKILL.md` as a protocol for LLM agents. There is no executable code in this directory.

The processing pipeline has six ordered stages:

| Stage | What happens |
|-------|-------------|
| 1. Parse | Extract actionable items from raw input. Separate context from tasks. Detect language (German/English). |
| 2. Phrasing | Rewrite each task to be verb-first, specific, correctly spelled, and AuDHD-friendly (one clear action per task). |
| 3. Taxonomy | Apply the emoji decoration chain: `[Status] [Priority] [Rigidity] [SpoonCost] [TaskText]`. Status is always `☑️` for new inbox items. Ideas use `[Status] [Type] [TaskText]` instead. |
| 4. Tags | Map tasks to OmniFocus tags across context, mode, people, spoon, and priority categories. |
| 5. Estimate | Set time estimates with ADHD buffers (e.g., stated 5min becomes 10-15min actual). |
| 6. Dates | Set due/defer/planned dates and flags only when clearly stated or inferable. |

The script interface is documented in `@/omnifocus-tasks/SKILL.md`. Key operations:
- `add_task.js` — Create task with full metadata (due, tags, estimates, project)
- `add_inbox.js` — Simple inbox capture
- `add_subtask.js` — Create nested subtasks (`--parent` or `--parent-id`) for `📦 -> 🗂️ -> 👣` hierarchy

All scripts use strict lookup for tags/projects via `findExistingTag()` and `findExistingProject()` — never auto-create, return candidates on ambiguity.

### Things to Know

- **Ask vs. infer**: The skill defines explicit boundaries for when to ask follow-up questions (ambiguous priority, unclear spoon cost, vague tasks, multiple interpretations) versus when to infer confidently (grocery items get `🛒 Supermarkt`, phone calls get `☎️ Telefon`). When multiple tasks need clarification, all questions must be batched into a single prompt.
- **Language preservation**: Tasks stay in the user's language. German stays German, English stays English. The agent fixes spelling and grammar but never translates.
- **Brain dump protocol**: For multi-item input, the agent must parse all items first, apply taxonomy to each, add all clear items immediately, then batch-ask about ambiguous ones -- never one question at a time.
- **Duplicate handling**: Potential duplicates are noted but added anyway. The inbox is a capture zone; deduplication happens during triage (`omnifocus-process`).
- **Response format**: After adding tasks, the agent must confirm with a structured summary showing the decorated task name, tags, estimate, and dates for each item.

Created and maintained by Nori.
