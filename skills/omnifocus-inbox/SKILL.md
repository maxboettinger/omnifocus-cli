---
name: omnifocus-inbox
description: "DEFAULT skill for adding tasks to OmniFocus — use for ANY request to add, create, hinzufügen, or anlegen tasks. Smart inbox capture with taxonomy-aware emoji decorations. Parses brain dumps, applies Max's lifeOS taxonomy (status/priority/rigidity/spoon/type), fixes phrasing for actionability, decomposes complex tasks, adds OmniFocus tags, and asks follow-up questions when context is ambiguous. Handles single tasks, multi-item brain dumps, and email-extracted action items in German or English."
---

# OmniFocus Smart Inbox

The single entry point for creating OmniFocus tasks. Handles everything from quick single captures to complex brain dumps and email extraction — with full taxonomy compliance, AuDHD-aware structuring, and proper tagging.

## Script

```bash
osascript -l JavaScript skills/omnifocus/scripts/add_inbox.js "TASK_NAME" [OPTIONS]
```

**Options:**
| Flag | Value | Example |
|------|-------|---------|
| `--note` | Context/details text | `--note "Frist endet am 10.02"` |
| `--due` | `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` | `--due "2026-02-10"` |
| `--defer` | `YYYY-MM-DD` (don't show until) | `--defer "2026-02-08"` |
| `--planned` | `YYYY-MM-DD` (plan for this day) | `--planned "2026-02-10"` |
| `--tag` | Existing OmniFocus tag name (repeatable, strict: never creates) | `--tag "🏡 Daheim" --tag "🐸 Frog"` |
| `--flag` | (no value) | `--flag` |
| `--estimate` | Minutes (integer) | `--estimate 15` |
| `--project` | Create directly in project (not inbox) | `--project "Haushalt"` |

**Returns:** JSON `{ ok, id, name, task: { full task object } }`

For sub-task creation (hierarchies: 📦→🗂️→👣), use `add_subtask.js`. See `omnifocus-tasks/SKILL.md` for script reference.

---

## Taxonomy & Tags

All taxonomy rules, emoji decoration chain, tag tables, spoon costs, and time estimation buffers are in [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md). Key points:

- **Emoji prefix order:** `[Status] [Priority] [Rigidity] [SpoonCost] [TaskText]` (or `[Status] [Type] [TaskText]` for ideas)
- **Status:** ☑️ (default for new), 💤 (someday/maybe), ⏸️ (blocked/waiting)
- **All tag categories:** context, mode, people, special, priority, spoon — see taxonomy reference

---

## Processing Rules

### 1. Parse the Input
User input may be:
- **Single task:** "Remind me to call the dentist"
- **Brain dump:** A wall of text mixing tasks, context, thoughts, and instructions
- **List:** Multiple items, possibly numbered or bullet-pointed
- **Email:** Forwarded/extracted action items with sender/deadline context
- **Mixed language:** German + English in the same message

**Your job:** Extract every actionable item. Separate context from tasks. Route ideas vs. actions correctly.

### 2. Fix & Improve Phrasing

Every task MUST start with a verb. Max's brain needs to read the task and immediately know the physical/mental action — zero interpretation needed.

**The test:** Can Max read this task at 7 AM with coffee-brain and know EXACTLY what to do?

| Bad (Vague) | Good (Actionable) |
|----------|--------------|
| Steuererklärung | Steuerberater-Portal öffnen und Belege für 2025 hochladen |
| Insurance | Versicherungspolice per Mail an Steuerberater weiterleiten |
| Julia flowers | Blumenstrauß bei Blume2000 online bestellen (Lieferung Sa) |
| Uni presentation | Folie 3-5 der Präsentation mit Quellen ergänzen |
| Arzt | Hausarzt Dr. [Name] anrufen und Termin für Attest vereinbaren |

**Rules:**
- German tasks stay German, English stays English — don't translate
- Fix typos and normalize spelling
- Include enough context that Max doesn't need to remember WHY ("Anrufen wegen X" not just "Anrufen")
- For phone calls: include WHO + ABOUT WHAT + phone number if known
- For emails: include TO WHOM + ABOUT WHAT + which account
- **AuDHD-friendly** — single clear action per task. If something is multi-step, note that in the task note and suggest breaking it down (see Step 5)

### 3. Assess Priority, Energy & Rigidity (THINK BEFORE DECORATING)

**Before slapping emoji on the task, STOP and think through each dimension explicitly.** This is the most common failure point — getting the classification wrong cascades into wrong tags, wrong energy budget, and wrong daily planning.

#### Priority — "What happens if Max doesn't do this?"
- **🔴 P1:** Real, external, immediate consequences (legal, financial, relationship damage, hard deadline TODAY)
- **🟠 P2:** Important with consequences if delayed, but not catastrophic (promised someone, soft deadline this week)
- **🟡 P3:** Should be done, flexible timing, no real fallout if it slips
- **🔵 P4:** Nice to do, purely optional, no pressure
- **Omit:** Ideas, vague captures, needs triage later

**Determine priority from CONSEQUENCES, not feelings.**

**Email-specific priority signals:**
- CC'd → usually 🔵 (FYI)
- Direct ask with deadline → 🟠 minimum
- Legal/financial/institutional → 🔴 if deadline, 🟠 otherwise
- Newsletter/promo → usually not a task at all
- Reply-needed from someone Max committed to → 🟠⚠️

**Example:** "Brief vom Finanzamt öffnen" → Finanzamt = authority, potential legal/financial consequences → 🟠 P2 minimum (could be 🔴 P1 if deadline-bound)

#### Energy/Spoon Cost — "How does this FEEL, not just what does it involve?"
Think about the **emotional load**, not just the physical steps. Apply AuDHD amplifiers from the [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md):

| Factor | Impact |
|--------|--------|
| Shame/guilt attached | +3🥄 minimum → often makes it a 🐸 |
| Confronting authority (Finanzamt, Behörden, Vermieter) | +3-4🥄 |
| Financial/legal content | +2-3🥄 |
| Phone call to stranger | +2-3🥄 |
| Requires masking (formal interaction) | +2🥄 |
| Unclear first step ("where do I even start?") | +2🥄 |
| Task deferred 3+ times | Probably a 🐸 already |

**The question is NOT "how many minutes does this take?" but "how much does this drain Max's battery?"** A 2-minute phone call to the Finanzamt is a 🐸, not a 🪫.

**Example:** "Brief vom Finanzamt öffnen" → financial/legal (+2-3🥄) + confronting authority (+3-4🥄) + likely shame/anxiety about what's inside (+3🥄) = clearly a 🐸, NOT a 🪫

#### Deadline Rigidity — "Is the deadline real, and who set it?"
- **‼️ FIXED:** External, immovable (appointment time, legal deadline, "doors close at 18:00")
- **⚠️ FIRM:** Real consequences if missed, but could technically be rescheduled
- **📌 TARGET:** Self-imposed, soft expectation, can slip without fallout
- **Omit:** No deadline, no time pressure

### 4. Apply Taxonomy Decorations
Based on your assessment in step 3, build the emoji prefix chain:
1. **Status** → Always ☑️ for new inbox items
2. **Priority** → From your step 3 assessment
3. **Rigidity** → From your step 3 assessment (only if deadline exists)
4. **Spoon cost** → From your step 3 assessment
5. **Type** → Use 💡 for ideas/thoughts instead of priority chain

### 5. Decompose if Needed (AuDHD Task Structuring)

**If Max can't start a task, the task is too big.** This is the single most important AuDHD accommodation.

#### Quick check: Does this need decomposition?
- **Single clear action** (send one email, make one call, open one letter) → NO, skip to step 6
- **"Secretly multiple tasks"** ("Steuer machen", "Umzug organisieren") → YES, decompose
- **Emotional blocker** (🐸 task) → Consider decomposing into non-frog approach steps

#### Decomposition levels
| Level | Question | If NO → |
|-------|----------|---------|
| Is this one action or secretly multiple? | Split into separate tasks |
| Can each piece be done in <30 minutes? | Break further |
| Does each piece have ONE clear action? | Split compound actions |

**The Micro-Step Rule:** Each 👣 Step should be phrased so granularly that Max could do it on autopilot.

#### AuDHD Design Patterns

**🐸 Frog Decomposition** — break the scary task into non-scary approach steps:
- `☑️🪫 Steuerberater-Portal Login-Daten raussuchen` (2min, no shame)
- `☑️🪫 Portal öffnen und offene Anforderungen lesen` (5min, just reading)
- `☑️🔋 Fehlende Belege aus Email-Ordner zusammensuchen` (20min, boring but doable)
- `☑️🐸 Belege hochladen und Steuerberater-Nachricht schreiben` (the ACTUAL frog)

**☎️ Phone Call Sandwich** — scripting reduces anxiety:
1. `🪫 Notizen für Telefonat schreiben (Wer, Was, Ziel)` — scripting
2. `🐸 [Person] anrufen — Thema: [X]` — the actual call
3. `🪫 Ergebnis des Telefonats in OmniFocus-Notiz festhalten` — closure

**⏸️ Waiting For Split** — separate what Max can do from what he's blocked on:
1. `☑️🟠⚠️🔋 [Action I can do now]`
2. `⏸️ waiting:[person] — [What I'm waiting for]`
3. `☑️🟡📌🪫 Nachfassen bei [person] wegen [topic]` (with defer date)

**🤔 Decision Reducer** — surface hidden decisions as explicit micro-steps:
- `☑️🪫 3 Geschenkideen für Julia notieren (Budget: €50)`
- `☑️🪫 Julia's Amazon-Wunschliste checken`
- `☑️🔋 Geschenk bestellen (Idee von oben auswählen)`

**When to decompose during inbox capture vs. later:**
- **Simple tasks** → add to inbox as-is, skip decomposition
- **Multi-step but clear** → add parent + sub-tasks now using `add_subtask.js`
- **Complex/unclear** → add parent to inbox with note "needs breakdown", decompose during planning

### 6. Determine & Verify Tags (MANDATORY)

**This step is NON-NEGOTIABLE.** Every task MUST get appropriate OmniFocus tags — both from context AND from the emoji decoration chain.

#### 6a. Map Emoji Decorations → OmniFocus Tags
The emoji prefix in the task name is NOT enough — the corresponding OmniFocus tags MUST also be applied:

| Decoration | → OmniFocus Tag |
|------------|-----------------|
| 🔴 (P1) | `🔴 P1` |
| 🟠 (P2) | `🟠 P2` |
| 🐸 (Frog) | `🐸 E1` |
| ⏸️ (Blocked) | `⏸️ blocked` or appropriate `⏸️ waiting:*` tag |

#### 6b. Map Context → OmniFocus Tags
Assign tags from ALL relevant categories (see [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md)):
- **Context** (where/how): 🏡 Daheim, 💼 Büro, 🌲 Draußen, 🛒 Supermarkt, etc.
- **Mode** (what kind): 🧠 Deep Work, 👨‍💻 Coding, ☎️ Telefon, ✉️ Mail, etc.
- **People** (who's involved): 🦊 Julia, 🐼 Jan, 🦜 Rudi, etc.
- **Special**: 🤖 Routines, 🏆 Quick Win, 🧱 Resistance, 😔 Guilt & Shame, etc.

#### 6c. Verify Tags Exist (MANDATORY)
Before applying ANY tag, verify it exists:
```bash
osascript -l JavaScript skills/omnifocus/scripts/list_tags.js --search "<partial>"
```
Copy the EXACT tag name from results. Never guess — typos fail silently (strict lookup). If a tag doesn't exist, note it and skip or ask Max.

### 7. Estimate Time
Apply ADHD buffer (see [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md#time-estimation-adhd-buffered)):
- Quick task (stated 5-15min) → estimate 10-20min
- Medium task (stated 30-60min) → estimate 45-90min
- Hard/frog task → estimate generously, at least 30min even if "quick"

### 8. Set Dates (only when clearly stated or inferable)
- **Due date:** Only if there's a real deadline
- **Defer date:** If "not before" or "starting from" is mentioned
- **Planned date:** If a specific day target is mentioned ("do this on Monday", "plan for Tuesday")
- **Flag:** For urgent items that need attention (P1, P2 with imminent deadlines)

---

## Email → Task Extraction Protocol

When extracting tasks from emails (used by #mail workflow):

### Identify the Action Type
| Email Pattern | Task Type |
|---------------|-----------|
| "Bitte senden Sie uns bis zum..." | 🔴/🟠 + ‼️/⚠️ — deadline task |
| "Könnten Sie..." / "Would you..." | 🟡/🟠 — assess urgency from context |
| "FYI" / "Zur Info" / CC'd | Usually not a task — archive or 🔵💡 |
| Invoice/bill | 🟠⚠️ — financial, check due date |
| Appointment confirmation | Not a task — verify calendar, only task if prep needed |
| "Bitte antworten Sie..." | 🟠 minimum — someone is waiting |
| Newsletter/marketing | Not a task — archive/delete |
| Shipping notification | 🟡📌🪫 — track if pickup needed |

### Enrich with Source Context
Every email-extracted task MUST include in the note field:
- **Source:** Which email account (👔🍎🎓🏡) + sender + subject
- **Deadline:** If mentioned in email, extract the EXACT date
- **Reply needed?** If yes, note the expected format/content
- **Dependencies:** Does this require info from someone else first?

---

## When to Ask vs. When to Infer

### INFER (don't ask):
- Grocery items → `🛒 Supermarkt` tag
- Phone calls → `☎️ Telefon` tag + 🐸/💥 spoon cost
- Email tasks → `✉️ Mail` tag + source account
- Financial tasks → `💶 Geld` tag
- Obvious priorities (tax deadline = 🔴, "nice to have" = 🔵)
- Spoon cost for clear task types (quick errand = 🪫, formal phone call = 🐸)

### ASK (batch all questions together):
- Priority ambiguous — "Is this urgent or can it wait?"
- Spoon cost unclear for emotional tasks — "How heavy does this feel — 🐸 frog or more like 🔋?"
- Deadline implied but not stated — "You mentioned 'soon' — actual date?"
- Task too vague — "'Handle insurance' — what specifically?"
- Multiple interpretations — "'Julia Blumen' — buy or remind?"
- Context needed for tagging — "Home or office?"

---

## Response Format

After adding tasks, confirm with a clear summary:

```
Added N tasks to OmniFocus inbox:

1. ☑️🟠⚠️🔋 Catering-Angebot prüfen und Julia Bescheid geben
   Tags: 🟠 P2, 🦊 Julia, 💬 Chat | 15min | Due: 2026-02-06

2. ☑️💡 "Upskill" GitHub-Repo anschauen
   Tags: 👨‍💻 Coding | 20min

[If questions remain:]
Noch Fragen zu:
- "Versicherung klären" — Was genau muss passieren?
- "Rudi" — Anrufen oder Nachricht schreiben?
```

---

## Multi-Task Processing (Brain Dumps)

1. Parse ALL items first
2. Apply taxonomy to each (steps 2-7)
3. Identify items needing clarification
4. Group by priority — present 🔴 first, then 🟠, then 🟡/🔵
5. Add all clear items immediately
6. Ask about ambiguous ones in a single batch
7. Add remaining items after clarification

**Efficiency:** Call the script once per task. For >5 tasks, process in sequence and report results at the end.

---

## Edge Cases

- **Duplicate detection:** Note potential duplication but ADD anyway — inbox is capture zone, triage happens later
- **Multi-step tasks:** Add parent + sub-tasks using `add_subtask.js` (see Step 5 for when to decompose now vs. later)
- **Recurring tasks:** Add with `🤖 Routines` tag + recurrence note
- **Waiting/blocked:** Use `⏸️` status + appropriate `waiting:` tag instead of ☑️
- **Recharging activities:** Use 🔌 — NOT low-priority! Essential for energy management
- **Ideas vs. tasks:** Ideas get `☑️💡` — no priority/rigidity/spoon. They skip the decoration chain.
- **Direct project placement:** Use `--project "Name"` to skip inbox when the destination is clear

---

## Related Skills

- `omnifocus-tasks` — Low-level CRUD reference (all scripts, flags, bulk operations). Use for raw updates/searches, NOT for task creation with classification.
- `omnifocus-tags` — Safe tag discovery, search, and CRUD. Use `list_tags.js --search` to verify tag names.
- `omnifocus-projects` — Project/folder discovery, creation, and management.
- `omnifocus-forecast` — Daily execution hub; quick-capture from forecast context routes here.
- `omnifocus-plan` — Estimation and prioritization (feeds into calendar-blocking).
- `omnifocus-process` — Inbox triage and routing.
- `calendar-blocking` — Time blocks from planned tasks.
