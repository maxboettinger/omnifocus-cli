# OmniFocus Taxonomy Reference

Canonical reference for Max's lifeOS taxonomy applied to OmniFocus tasks. All OmniFocus skills reference this document — do NOT duplicate these tables elsewhere.

## Emoji Decoration Chain

Every task name MUST be prefixed with an emoji decoration chain. The order is strict:

```
[Status] [Priority] [Rigidity] [SpoonCost] [TaskText]
```

For ideas/thoughts:

```
[Status] [Type] [TaskText]
```

### Status (ALWAYS first)

| Emoji | When |
|-------|------|
| ☑️ | New/upcoming task (DEFAULT for all new inbox items) |
| 💤 | Someday/maybe — explicitly deferred, not actionable now |
| ⏸️ | Blocked/waiting — use with `waiting:*` tags |

### Priority (REQUIRED if urgency/importance is known)

| Emoji | Level | When |
|-------|-------|------|
| 🔴 | P1 | Critical. Real consequences if not done TODAY/ASAP |
| 🟠 | P2 | Important. Should do today/this week, consequences if delayed |
| 🟡 | P3 | Normal priority. Should be done, but flexible timing |
| 🔵 | P4 | Low / informational. Nice to do, no real pressure |

**When to OMIT:** Ideas (💡), vague captures, items needing triage later. Omit rather than guess.

**Priority OmniFocus tags (P1/P2 only):**
| Emoji | Tag |
|-------|-----|
| 🔴 | `🔴 P1` |
| 🟠 | `🟠 P2` |

### Deadline Rigidity (REQUIRED if a deadline exists)

| Emoji | Level | When |
|-------|-------|------|
| ‼️ | FIXED | Immovable external constraint (appointment, hard cutoff, "doors close") |
| ⚠️ | FIRM | Real consequences if missed, but technically movable |
| 📌 | TARGET | Self-set or soft expectation, can slip |

**When to OMIT:** No deadline, no time pressure, ideas.

### Spoon Cost (ADD when energy impact is clear)

| Emoji | 🥄 Cost | When |
|-------|---------|------|
| 🐸 | 10 | "Eat the frog" — shame/guilt/anxiety-loaded. Max 1-2/day on a GOOD day |
| 💥 | 6-8 | Hard — needs concentration, may involve confronting anxiety |
| 🔋 | 3-5 | Medium — normal task, not fun but not terrible |
| 🪫 | 1-2 | Low — micro-task, quick win, no thinking needed |
| 🔌 | +5 | RECHARGES energy — pleasant activity (sports, creation, fun) |

**Spoon budget:** ~20🥄/day baseline. Never overload. Never plan more than 1-2 🐸/day.

**Spoon OmniFocus tag:** Only `🐸 Frog` gets a tag (for frogs).

**AuDHD-specific spoon amplifiers:**
| Factor | Impact |
|--------|--------|
| Shame/guilt attached | +3🥄 minimum (often makes it a 🐸) |
| Requires masking (formal interaction, Sie-Form) | +2🥄 |
| Sensory environment (loud, crowded) | +1-2🥄 |
| Multiple context switches | +1🥄 per switch |
| Unclear first step | +2🥄 ("where do I even start?" tax) |
| Phone call to stranger | +2-3🥄 (social anxiety) |
| Confronting authority | +3-4🥄 (shame/power dynamic) |
| Financial/legal task | +2-3🥄 (shame/guilt) |
| Task deferred 3+ times | Probably a 🐸 — the avoidance IS the indicator |

**When to OMIT:** Unknown energy impact, needs clarification. Ask rather than guess wrong.

### Entity Type (ONLY for ideas/thoughts)

| Emoji | When |
|-------|------|
| 💡 | Idea, thought, suggestion — goes AFTER status, REPLACES priority/rigidity/spoon |

### Examples

| Task Name | Explanation |
|-----------|-------------|
| `☑️🔴‼️🐸 Steuerberater wegen Zahlungsfrist anrufen` | Critical, fixed deadline, frog (shame/anxiety) |
| `☑️🟠⚠️🔋 Catering-Angebot abchecken und Julia Bescheid geben` | Important, firm deadline, medium effort |
| `☑️🟡📌🪫 Paket bei Station 266 abholen` | Normal priority, self-set target, quick task |
| `☑️🔵🪫 Handyhülle bei Amazon bestellen` | Low priority, easy, no deadline |
| `☑️💡 "Upskill" GitHub-Repo anschauen` | Idea — no priority/deadline/spoon needed |
| `☑️🔴⚠️💥 Psychiater-Termin für Attest vereinbaren` | High priority, firm, hard (phone anxiety) |
| `☑️🔌 30min Fahrrad fahren` | Recharging activity |

---

## OmniFocus Tags

### Context Tags (WHERE/HOW)

| Tag | When |
|-----|------|
| `🏡 Daheim` | Task done at home |
| `💼 Büro` | Task done at office |
| `🌲 Draußen` | Outdoor errand |
| `🏙️ Leipzig` | Requires being in Leipzig |
| `🏙️ Stuttgart` | Requires being in Stuttgart |
| `🛒 Supermarkt` | Grocery shopping |
| `📬 Post` | Post office |
| `🏥 Hausarzt` | GP appointment |
| `🥼 Psychiater` | Psychiatrist appointment |
| `🎓 Uni` | University-related |
| `🏢 Innenstadt` | City center errand |

### Mode Tags (WHAT KIND of work)

| Tag | When |
|-----|------|
| `🧠 Concentrating` | Deep focus work |
| `📬 Communicating` | Involves messaging/calling |
| `✉️ Mail` | Email task |
| `💬 Chat` | Chat/messaging task |
| `☎️ Telefon` | Phone call required |
| `👨‍💻 Coding` | Programming task |
| `📖 Reading` | Reading task |
| `✏️ Writing` | Writing task |
| `🛍️ Shopping` | Buying something |
| `💶 Geld` | Financial/money task |

### People Tags

| Tag | Person |
|-----|--------|
| `🦊 Julia` | Julia (partner) |
| `🦜 Rudi` | Rudi (uncle) |
| `🐼 Jan` | Jan |
| `🎩 Basti` | Basti |

### Special Tags

| Tag | When |
|-----|------|
| `🤖 Routines` | Recurring/routine task |
| `🎒 Einpacken` | Something to pack/bring |
| `⏰ TIME CRITICAL` | Time-sensitive task |
| `🏆 Quick Win` | Easy win for momentum |
| `🧱 Resistance` | Task with emotional resistance |
| `💡 Idee` | Idea to explore later |
| `⏸️ blocked` | Blocked by something |
| `⏸️ waiting:julia` | Waiting on Julia |
| `⏸️ waiting:jan` | Waiting on Jan |
| `⏸️ waiting:other` | Waiting on someone else |

---

## Time Estimation (ADHD-Buffered)

ADHD brains systematically underestimate time (Planning Fallacy). Apply buffers:

| Stated Duration | Actual Estimate | Buffer |
|----------------|-----------------|--------|
| "5 minutes" | 10-15 min | +100-200% |
| "15 minutes" | 20-25 min | +50-75% |
| "30 minutes" | 45-50 min | +50% |
| "1 hour" | 1.5 hours | +50% |
| "2+ hours" | 2.5-3 hours | +30% + break |

**Additional time taxes:**

| Factor | Extra Time |
|--------|-----------|
| Phone call | +10min (psych-up + recovery) |
| Context switch | +15min between different-type tasks |
| Location change | +30min minimum |
| Emotional task | +15min (pre-task dread + post-task decompression) |

---

## Task Decomposition Hierarchy

From the lifeOS taxonomy:

```
👣 Step    — micro-task, <15min, single action (planned for Units: 45min)
🗂️ Task    — collection of Steps (planned for Sessions: 90min)
📦 Package — collection of Tasks (planned for a Week)
🧰 Project — collection of Packages (planned for Months/Quarters)
```

**Decomposition rules:**
1. **Single or multiple?** If multiple actions → decompose
2. **<30 min each piece?** If not → break further
3. **One clear action each?** "Research AND summarize" = TWO, split them

**Purpose tags (on Projects/Packages, inherited by children):**
| Emoji | Purpose |
|-------|---------|
| 🛠️ | Upkeep — maintenance, admin, keeping things running |
| 🎨 | Creation — building, creative work, making things |
| 🚀 | Ambition — growth, career, big goals |

---

## OmniFocus Metadata Fields

Complete set of task fields available via JXA scripts:

| Field | Type | Writable | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Task name with emoji decoration chain |
| `id` | string | no | OmniFocus internal ID |
| `note` | string | yes | Task notes/context |
| `dueDate` | date/null | yes | Hard deadline (YYYY-MM-DD) |
| `deferDate` | date/null | yes | When task becomes available |
| `plannedDate` | date/null | yes | When you plan to work on it (OF 4.7+) |
| `effectiveDueDate` | date/null | no | Inherited due date |
| `effectiveDeferDate` | date/null | no | Inherited defer date |
| `effectivePlannedDate` | date/null | no | Inherited planned date |
| `flagged` | boolean | yes | Flagged for attention |
| `effectiveFlagged` | boolean | no | Inherited flag status |
| `estimatedMinutes` | int/null | yes | Time estimate in minutes |
| `completed` | boolean | yes | Completion status |
| `completionDate` | date/null | no | When completed |
| `creationDate` | date/null | no | When created |
| `modificationDate` | date/null | no | Last modified |
| `sequential` | boolean | yes | Children execute sequentially |
| `inInbox` | boolean | no | Whether in inbox |
| `blocked` | boolean | no | Whether blocked by sequential sibling |
| `project` | string | yes | Containing project name |
| `parentTask` | object/null | no | `{ id, name }` of parent task |
| `tags` | array | yes | Tag names |
| `repetitionRule` | object/null | yes | `{ rule: "RRULE", method: "due date" }` |
| `childCount` | int | no | Number of child tasks |

**Date distinction (OmniFocus 4.7+):**
| Date | Property | Meaning |
|------|----------|---------|
| Defer | `deferDate` | When task becomes AVAILABLE (hidden until this date) |
| Planned | `plannedDate` | When you PLAN to work on it (remains available, just scheduled) |
| Due | `dueDate` | Hard deadline |

---

## Available Scripts

All OmniFocus scripts live in `omnifocus/scripts/`. Run with:

```bash
osascript -l JavaScript skills/omnifocus/scripts/<script>.js [args]
```

| Script | Purpose | Key Flags |
|--------|---------|-----------|
| `add_task.js` | Create task (inbox or project) | `--note --due --defer --planned --tag --flag --estimate --project --sequential --repeat --repeat-method` |
| `add_inbox.js` | Create inbox task (optional project move) | Same as add_task.js |
| `add_subtask.js` | Create child task under existing task | `--parent --parent-id` + standard flags |
| `update_task.js` | Update any task property | `--id --name --note --note-append --due --defer --planned --flag --unflag --estimate --tag --remove-tag --project --sequential --parallel --repeat --repeat-method --complete --incomplete` |
| `complete_task.js` | Complete/uncomplete task | `--id --incomplete` |
| `list_tasks.js` | List tasks with filters | `inbox\|available\|flagged\|due-soon\|overdue\|all [limit]` |
| `search_tasks.js` | Search by keyword | `"keyword" [limit]` |
| `list_by_tag.js` | List tasks by tag | `"Tag Name" [limit]` |
| `process_inbox_item.js` | Full inbox item processing | All update flags + `--delete --dry-run` |
| `forecast.js` | Daily forecast with buckets | `[days] [--include-flagged] [--include-available]` |
| `get_stats.js` | OmniFocus statistics | (no args) |
| `get_estimated_time.js` | Get task estimates | `"query" or (no args for all)` |
| `set_estimated_time.js` | Set/clear task estimates | `"query" minutes` |
| `weekly_review.js` | Weekly completed summary | `[weeks_ago]` |
| `list_tags.js` | List/search tags (compact) | `--search --count --active-only --limit` |
| `apply_tag.js` | Apply existing tag(s) strictly | `--id --tag` (repeatable, never creates) |
| `create_tag.js` | Create new tag | (positional name) |
| `delete_tag.js` | Delete tag (safety check) | `--confirm` |
| `rename_tag.js` | Rename tag | `--name "New Name"` |

**All write operations return:** `{ ok: true/false, ... }`
**All read operations return:** JSON arrays or objects
**All `--tag` flags use strict lookup** (`findExistingTag`): tags are never auto-created. Misspelled or unknown tag names produce an error with suggestions. Use `create_tag.js` for explicit tag creation.

See `omnifocus/SKILL.md` for full script documentation with examples.
See `omnifocus-tags/SKILL.md` for tag management workflow and safety guidelines.
