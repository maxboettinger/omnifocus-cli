# Noridoc: omnifocus-process

Path: @/omnifocus-process

### Overview

This is a behavioral/protocol skill (no scripts of its own) that defines how to triage and process Max's OmniFocus inbox. It implements a 4-phase protocol -- Fetch & Classify, Present Suggestions, Execute, Learn -- that routes inbox items to one of nine destinations. The protocol is explicitly designed around AuDHD-aware processing: batched presentation (5-7 items), momentum-building ordering, decision fatigue prevention, and shame-free framing.

### How it fits into the larger codebase

This skill orchestrates across most of the openclaw skills ecosystem. It is a pure consumer -- it owns no scripts and instead delegates all execution to other skills:

- **OmniFocus task operations** (`@/omnifocus-tasks`): Uses documented operations for fetching (`list_tasks.js inbox`), updating (`process_inbox_item.js` for mutations, `update_task.js` for properties), searching (`search_tasks.js` for duplicate detection), and breaking down (`add_subtask.js` for complex items). All operations in `@/omnifocus/scripts/`.
- **Taxonomy** (`@/omnifocus/references/taxonomy-reference.md`): All task decoration (Status-Priority-Rigidity-Spoon-Name emoji chain) follows this shared reference.
- **Outbound routing**: Items classified as non-tasks get routed to `@/obsidian-daily` (thoughts/reflections via `append_daily.py`), `@/openmemory` (personal facts via `omem add`), `@/raindrop` (bookmarks), or `@/maxtex` (structured data stores like `atlas.db`).
- **Context resolution**: Before asking Max about cryptic entries, the protocol queries OpenMemory, memory files, OmniFocus search, Obsidian, and REGISTRY.md in a defined priority order.
- **Sibling skills**: `@/omnifocus-inbox` handles capture (adding new items), `@/omnifocus-forecast` handles daily planning, `@/omnifocus-plan` handles time estimation, and `@/omnifocus-tasks` provides comprehensive documentation for all task operations. This skill sits between capture and planning -- it is the triage step.

### Core Implementation

The protocol is defined entirely in `SKILL.md` and operates in four phases:

**Phase 1 (Fetch & Classify)** fetches all inbox items and classifies each into one of nine routing categories: Delete/Complete, Keep in OmniFocus, Break Down, Route to Obsidian (thoughts), Route to Obsidian (knowledge), Route to OpenMemory, Route to Raindrop, Route to Data Stores, Route to BACKLOG, or Ask Max. Classification relies on a context resolution chain (OpenMemory first, common sense last) to interpret cryptic captures.

**Phase 2 (Present Suggestions)** batches items in groups of 5-7 with a strict momentum-building order: stale/done items first (quick wins), then quick-process items, then route-away items, then decorate-and-file items, then complex breakdowns, and finally items needing clarification last. Each item gets exactly one suggested action -- not options.

**Phase 3 (Execute)** processes Max's approvals or modifications by calling the appropriate scripts and external tools, then moves to the next batch.

**Phase 4 (Learn)** logs session stats to `memory/YYYY-MM-DD.md` and updates OpenMemory with any new personal context learned during clarification. Routing patterns that repeat 3+ times get promoted to permanent rules in the SKILL.md itself.

### Things to Know

The BACKLOG routing category specifically targets an OmniFocus project named "BACKLOG" -- not a local file or external system. Items routed there get the `💤💡` prefix and represent someday/maybe ideas. All project references use `findExistingProject()` (strict: never creates), so the BACKLOG project must exist before items can be routed there. If it doesn't exist, the operation fails with suggestions. Use `@/omnifocus-projects` skill for project discovery and creation.

The skill maintains a known-abbreviations table (e.g., J = Julia, R = Rudi, Jan = brother + business partner, HdM = Hochschule der Medien Stuttgart) that grows over time as Max clarifies cryptic entries. This table is part of the skill's self-modifying learning loop.

Time estimates for tasks staying in OmniFocus include an explicit ADHD buffer of +40-50% over naive estimates.

The presentation format includes a batch counter (`[batch N/total]`) and a running processed-item counter to maintain visible progress momentum. Max can approve an entire batch with a single confirmation or selectively override individual suggestions.

Created and maintained by Nori.
