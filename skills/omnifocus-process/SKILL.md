---
name: omnifocus-process
description: "Process OmniFocus inbox items: classify, route, decorate, and organize. Helps Max triage his universal inbox by inferring context, suggesting actions, and routing items to the correct destination (OmniFocus projects, Obsidian, OpenMemory, etc.). AuDHD-aware: reduces decision fatigue, presents batches, builds momentum."
---

# OmniFocus Inbox Processing

Help Max process his OmniFocus inbox — his universal capture bucket for tasks, thoughts, ideas, questions, and everything in between. Classify each item, suggest a destination and action, then execute approved changes.

## When to Use

- Max asks to "process inbox", "clean inbox", "what's in my inbox?"
- Morning/evening routines that include inbox triage
- Triggered by high inbox count (>10 items during forecast)

## Core Script

```bash
# List current inbox
osascript -l JavaScript skills/omnifocus/scripts/list_tasks.js inbox

# Process a single item (by ID)
osascript -l JavaScript skills/omnifocus/scripts/process_inbox_item.js <ID> [OPTIONS]
```

See `omnifocus/SKILL.md` for full `process_inbox_item.js` docs. Key flags:
`--name`, `--note`, `--note-append`, `--project`, `--tag`, `--due`, `--defer`, `--estimate`, `--flag`, `--complete`, `--delete`, `--dry-run`

## Protocol

### Phase 1: Fetch & Classify

1. Fetch inbox: `list_tasks.js inbox`
2. For each item, classify into a **routing category** (see below)
3. Use personal context to understand cryptic entries:
   - Check OpenMemory (`omem search`) for people, relationships, context
   - Check REGISTRY.md for data stores and systems
   - Check recent memory files for conversation context
   - Use [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md) for decoration
4. Items you genuinely can't understand → mark as `❓ Ask`

### Phase 2: Present Suggestions (Batched)

Present items in groups of **5–7** (never all at once — AuDHD decision fatigue).

**Presentation order** (momentum-building):
1. 🗑️ **Stale/Done** — obvious deletes (quick wins, feels good)
2. 🪫 **Quick Wins** — items you can fully process with minimal input
3. 💭 **Route Away** — items going to Obsidian/OpenMemory/other (clears inbox without OmniFocus overhead)
4. 🔧 **Decorate & File** — items staying in OmniFocus that need taxonomy + project
5. 📦 **Break Down** — complex items needing decomposition into sub-tasks
6. ❓ **Ask** — items needing clarification

**Format per item:**
```
[batch N/total] Processing inbox (X items):

🗑️ STALE / DONE:
1. "Adventskalender besorgen" — It's February. 
   → 🤖 Delete

🪫 QUICK PROCESS:
2. "Prime kündigen" 
   → 🤖 Decorate: ☑️🟡📌🪫 Amazon Prime kündigen | 🛍️ Shopping | ⏱️ 10min

💭 ROUTE ELSEWHERE:
3. "jan keine religion witze sagen"
   → 🤖 Save to OpenMemory as social context + delete from inbox

🗃️ BACKLOG:
N. "Coole App-Idee für X"
   → 🤖 Move to BACKLOG project: 💤💡 App-Idee: X

🔧 DECORATE & FILE:
4. "Hochzeitswebsite registration broken?"
   → 🤖 ☑️🟠⚠️🔋 Hochzeitswebsite: Registration-Bug debuggen | 👨💻 Coding, 🦊 Julia | ⏱️ 45min
   → Move to: 🧰 Hochzeit project

📦 BREAK DOWN:
5. "TIML - Hands On während der Präsi"
   → 🤖 Create sub-tasks: research options, build demo, test → need more context

❓ NEED CONTEXT:
6. "Michell ins dl"
   → Who is Michell? What is "dl"? (Download? Dropbox link? Dienstleistung?)

React with ✅ to approve all, or tell me which to change.
```

### Phase 3: Execute

After Max approves (or modifies):
- Execute changes via `process_inbox_item.js` (OmniFocus actions)
- Route to other destinations using their respective tools
- Report results concisely
- Move to next batch if items remain

### Phase 4: Learn

After each processing session:
- Note patterns in `memory/YYYY-MM-DD.md` (e.g., "Max always wants X type of items in Y")
- Update OpenMemory with new personal context learned from clarification answers
- If a routing pattern repeats 3+ times, add it to this SKILL.md's routing rules

---

## Routing Categories & Destinations

### 🗑️ Delete / Complete
**Route:** `process_inbox_item.js <ID> --delete` or `--complete`
**When:**
- Clearly outdated (seasonal items in wrong season, past events)
- Already done (Max did it but didn't check off)
- Duplicate of existing task (search first: `search_tasks.js`)
- One-off reminder that's no longer relevant

### ✅ Keep in OmniFocus (Decorate & File)
**Route:** `process_inbox_item.js <ID> --name "decorated" --tag ... --estimate ... [--project ...]`
**When:**
- Actionable task with clear next step
- Has a deadline or time pressure
- Involves doing something specific
**Process:** Follow `omnifocus-inbox` steps 2-7 (phrasing → assess priority/energy/rigidity → decorate → tags → estimate → dates), then execute via `process_inbox_item.js`:
1. Move to project if obvious; otherwise leave in inbox for Max to file
2. Flag if P1/P2 with imminent deadline

### 📦 Break Down (Complex Items)
**Route:** Process parent + `add_subtask.js` for children
**When:**
- Multi-step item ("Steuererklärung machen")
- Vague umbrella ("Hochzeit planen")
- Task with embedded sub-tasks
**Process:** Follow `omnifocus-inbox` Step 5 (Decompose if Needed) for decomposition levels and AuDHD design patterns (Frog Decomposition, Phone Call Sandwich, etc.). Execute via `add_subtask.js` for the hierarchy.

### 💭 Route to Obsidian (Gedanken)
**Route:** `python3 skills/obsidian-daily/scripts/append_daily.py -s gedanken -c "..."` + delete from inbox
**When:**
- Thoughts, reflections, ideas about life/self/patterns
- "I noticed..." / "Es ist mir aufgefallen..." captures
- Interesting observations with no action required
- Connections between concepts
- Personal insights worth revisiting in weekly review

### 💡 Route to Obsidian (Knowledge Note)
**Route:** Obsidian note (via obsidian-cli or direct file write) + delete from inbox
**When:**
- Reference information to save long-term
- Research findings, useful links, how-to notes
- Information that belongs in Max's knowledge base (not daily note)

### 🧠 Route to OpenMemory
**Route:** `omem add "..."` + delete from inbox
**When:**
- Personal facts, preferences, relationship context
- Social rules ("jan keine religion witze" → "Don't make religion jokes around Jan")
- Self-knowledge ("I work better with X", "Y makes me anxious")
- Context about people that helps future interactions

### 🔖 Route to Raindrop
**Route:** `raindrop` skill + delete from inbox
**When:**
- URLs or "check out this link/tool/website"
- Items that are essentially bookmarks with optional annotation

### 📊 Route to Data Stores
**Route:** Appropriate SQL/tool + delete from inbox
**When:**
- Supplement/health info → `atlas.db` supplements table
- Device info → `atlas.db` devices table
- Service info → `atlas.db` services table

### 🗃️ Route to BACKLOG (OmniFocus)
**Route:** `process_inbox_item.js <ID> --name "💤💡 ..." --project "BACKLOG"` (OmniFocus project, NOT a local file)
**Note:** If BACKLOG project doesn't exist yet, create it first via OmniFocus or ask Max to set it up.
**When:**
- Someday/maybe project ideas
- "It would be cool if..." captures
- Feature ideas for Max's apps/tools/systems
- Things with no timeline but worth not forgetting

### ❓ Ask Max
**When:**
- Cryptic abbreviations you can't resolve with context
- Ambiguous intent (task vs thought vs reminder?)
- Missing context that changes the routing
- People you don't recognize

**How to ask:**
- Be specific: "Who is Michell? Is 'dl' a download or something else?"
- Offer your best guess: "I think this means X — correct?"
- Batch ALL questions together (never one-at-a-time)

---

## Context Resolution Strategy

Before asking Max, try these in order:

1. **OpenMemory** — `omem search "<person/topic>"` for people, relationships, context
2. **Memory files** — `memory/YYYY-MM-DD.md` for recent conversation context
3. **OmniFocus** — `search_tasks.js "<keyword>"` for existing related tasks/projects
4. **Obsidian** — search vault for related notes
5. **REGISTRY.md** — check if it maps to a known data store
6. **Common sense** — German abbreviations, context clues, emoji interpretation

**Known abbreviations** (add more as learned):
- J = Julia (partner)
- R = Rudi (uncle)
- Jan = brother + business partner
- HdM = Hochschule der Medien Stuttgart
- Uni = Universität Leipzig
- Basti = friend
- DL = unclear (ask!)

---

## AuDHD-Aware Processing

### Decision Fatigue Prevention
- Never present more than 7 items at once
- Group by action type (all deletes together, all routes together)
- Start with easiest decisions (stale → quick wins → complex)
- Provide ONE clear suggestion per item (not options)
- "Approve all" shortcut for the obvious ones

### Momentum Building
- Start with items that can be deleted/completed (instant progress visible)
- Count items as you go: "✅ 4/20 processed — inbox shrinking!"
- Quick wins early → cognitive load items later
- Never end a batch with the hardest items

### Shame-Free Processing
- Old items are fine. No "this has been here since November..."
- Frame as: "Let's see what's still relevant" not "look at this pile"
- If Max abandons mid-processing, that's OK — save progress, continue later
- Track what was processed so sessions can resume

### Energy Matching
- If Max seems low-energy: only do stale cleanup + quick wins, skip complex items
- If Max is in flow: go through the full batch, break down complex items
- Always offer to stop: "Want to keep going or save the rest for later?"

---

## Integration with Other Skills

| Skill | When Used |
|-------|-----------|
| `omnifocus-inbox` | Task creation, decoration, structuring, and decomposition (single source of truth for taxonomy compliance) |
| `omnifocus-tags` | Tag discovery (`list_tags.js --search`) and dedicated tag ops (`apply_tag.js`, CRUD). All `--tag` flags use strict lookup (never creates tags). |
| `omnifocus-forecast` | Checking if processed tasks affect today's spoon budget |
| `omnifocus-plan` | Estimating time for complex items |
| `obsidian-daily` | Routing thoughts/reflections to daily notes |
| `openmemory` | Saving personal context learned from inbox items |
| `raindrop` | Routing bookmarks/URLs |
| `maxtex` | Checking/updating data stores |

---

## Session Tracking

After processing, update `memory/YYYY-MM-DD.md`:
```
## Inbox Processing
- Processed: X items
- Deleted stale: N
- Decorated & filed: N
- Routed to Obsidian: N
- Routed to OpenMemory: N
- Broken down: N
- Still pending: N (items left in inbox)
- Clarifications asked: [list]
```

And if patterns emerge (3+ sessions), update this SKILL.md's routing rules or known abbreviations.

---

## Manual Test

```bash
# Preview inbox
osascript -l JavaScript skills/omnifocus/scripts/list_tasks.js inbox

# Dry-run a single item
osascript -l JavaScript skills/omnifocus/scripts/process_inbox_item.js "<ID>" --dry-run --name "☑️🟡📌🪫 Example task" --tag "📬 Communicating"

# Full process
osascript -l JavaScript skills/omnifocus/scripts/process_inbox_item.js "<ID>" --name "☑️🟡📌🪫 Example task" --tag "📬 Communicating" --estimate 10
```
