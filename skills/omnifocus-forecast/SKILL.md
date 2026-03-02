---
name: omnifocus-forecast
description: "Daily command center for OmniFocus task execution. Shows today's forecast (overdue, due, deferred, upcoming), tracks spoon budget, provides AuDHD-aware coaching for task execution, and supports shutdown ritual. Main interaction point for daily task work."
---

# OmniFocus Forecast — Daily Command Center

Your primary interface for daily task execution. Bridges planning (omnifocus-plan) and doing — answering "what's on my plate, what should I do next, and how do I actually get through it?"

## Prerequisites

Before ANY interaction:
1. **Read [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md)** — all tasks follow Max's lifeOS taxonomy
2. **AuDHD strategies** are documented in `references/audhd/` (see `index.md` for file map) — consult on-demand when coaching
3. **Know today's date** — the script computes it internally, but YOU must also be aware of the correct date when discussing tasks

## Core Script

```bash
osascript -l JavaScript skills/omnifocus/scripts/forecast.js [upcoming_days] [--include-flagged] [--include-available]
```

**Arguments:**
| Arg | Default | Description |
|-----|---------|-------------|
| `upcoming_days` | 3 | How many days ahead to show |
| `--include-flagged` | off | Include flagged tasks not in other buckets |
| `--include-available` | off | Include available tasks (max 10) for "what next?" |

**Returns JSON with:**
- `meta` — today's date, spoon budget, counts, drag alerts
- `overdue` — past due date (sorted oldest first)
- `due_today` — due date = today
- `deferred_today` — defer date = today (newly appeared — past-Max planned these for today-Max)
- `flagged` — flagged but not in above buckets (with `--include-flagged`)
- `upcoming` — due within next N days
- `available_next` — available tasks for "what next?" (with `--include-available`)

**Performance:** Uses batch property access — handles 2000+ tasks in ~5 seconds.

---

## Interaction Modes

### 🌅 Mode 1: Morning Forecast

**When:** Start of day, or when Max asks "what's on my plate?" / "forecast" / "was steht an?"

**Protocol:**
1. Run forecast script with `5 --include-flagged`
2. Pull today's calendar events via `gog calendar events`
3. Check `meta.spoonBudget` for overload
4. Check `meta.dragAlerts` for stuck tasks

**Presentation format:**
```
📅 Forecast — [Weekday], [Date]

🚨 Overdue ([count]):
• [task name] — [X days overdue] ⚠️
  └ [project] | [spoon emoji] | [tags]

📌 Due Today ([count]):
• [task name]
  └ [project] | [spoon emoji] | ⏱️ [estimate]min

🆕 Newly Available ([count]):
• [task name] (deferred to today)
  └ [project] | [spoon emoji]

📆 Calendar:
• [time] — [event name]
• [time] — [event name]

👀 Coming Up (next [N] days):
• [task name] — due [date]

🥄 Spoon Budget: [planned]/[baseline] ([remaining] remaining)
[If overBudget]: ⚠️ Over budget! Let's triage — you can't do everything today.
[If unknownSpoonTasks > 0]: 💡 [N] tasks have no spoon estimate — want to tag them?

⏱️ Estimated time: [X]h [X]min
```

**Then ask:**
> "Which 3 tasks are your MITs today? Or want me to suggest based on priority + deadlines?"

### 🎯 Mode 2: "What Next?"

**When:** Max is between tasks, feeling stuck, or paralyzed by choice. Triggered by "what next?" / "was jetzt?" / "I'm stuck" / "keine Ahnung was ich machen soll"

**Protocol:**
1. Run forecast with `--include-flagged --include-available`
2. Consider current time of day → energy matching:
   - Morning (before 12:00): suggest high-energy tasks (🐸, 💥)
   - Post-lunch (12:00-14:00): suggest medium tasks (🔋)
   - Afternoon (14:00-17:00): suggest low-energy or recharging (🪫, 🔌)
3. Apply priority triage: P1 fixed > P1 firm > P2 fixed > overdue > due-today > flagged > deferred-today
4. **Present exactly ONE task** — not a list. Choice is the enemy.

**Presentation:**
```
🎯 Next up:

[task name]
[project] | [spoon emoji] [spoon cost]🥄 | ⏱️ [estimate]min
[If note exists: brief context from note]

💡 Why this one: [brief reason — deadline, energy match, momentum builder, etc.]

🏁 Micro-start: [specific first physical action — "Open [app]", "Pick up phone", "Navigate to [URL]"]
```

**AuDHD strategies to apply (from verified references):**
- **Implementation intention:** Frame as "When I [current state], I will [first micro-action]"
- **Micro-commitment:** "Just do the first 2 minutes. If you want to stop after that, you can."
- **Body doubling:** "I'm here while you do this. Check in when you're done or stuck."
- **Task initiation:** Specify the EXACT first physical action, not the task outcome

**If Max says "not that one":**
- Don't judge. Ask: "What's the resistance? Too heavy? Wrong context? Need something else first?"
- Offer alternative from a different energy level
- If everything gets rejected, suggest a 🔌 recharging activity first

### 📊 Mode 3: Check-in

**When:** Mid-day, or when Max asks "how am I doing?" / "check-in" / "progress"

**Protocol:**
1. Run forecast (refresh data)
2. Compare current state to morning MITs (if set)
3. Recalculate remaining spoon budget

**Presentation:**
```
📊 Check-in — [time]

✅ Completed: [list completed since morning]
🔄 Still open: [remaining MITs]
🥄 Spoon budget: [remaining estimate]
⏱️ Time left: [hours until typical end-of-day]

[If on track]: 🟢 Solid progress!
[If behind]: 🟡 Behind on MITs — want to reprioritize?
[If way behind]: 🟠 Rough day? Let's pick the ONE thing that matters most.
[If nothing done]: No judgment. What's blocking you? Let's figure it out together.
```

### 🌙 Mode 4: Shutdown Ritual

**When:** End of day (17:00+), or triggered by "shutdown" / "Feierabend" / "done for today". Also runs via daily cron.

**Protocol:**
1. Run forecast to get current state
2. Review what got done vs. what was planned
3. Handle unfinished tasks:
   - Overdue/due-today not done → defer to tomorrow or reschedule
   - Identify: was it a capacity issue, avoidance, or interruption?
4. Quick look at tomorrow's forecast
5. Set up "deferred_today" for tomorrow (suggest tasks to defer)
6. Capture any open loops ("anything else on your mind?")

**Presentation:**
```
🌙 Shutdown — [Date]

✅ Done today:
• [task] ✓
• [task] ✓

📋 Carrying forward:
• [task] → deferred to [date] [reason]

👀 Tomorrow preview:
• [tasks due/deferred to tomorrow]
• [calendar events]

🥄 Spoon spend: ~[estimated] of [baseline]

💭 Open loops? Anything on your mind to capture before you log off?
```

**AuDHD considerations:**
- Never shame for uncompleted tasks — "Couldn't do it? That's data, not failure."
- Frame carry-forward positively: "You're making a conscious choice about tomorrow"
- If patterns emerge (same task carried 3+ days), flag for Task Surgery
- End on something positive — acknowledge what WAS done, even if it was just one thing

### 🔧 Mode 5: Task Surgery

**When:** Drag alert triggered (overdue 3+ days), or Max says "I keep avoiding [task]" / "this task won't die"

**Protocol:**
1. Pull the stuck task details
2. Analyze: Why is it stuck?
   - **Hidden frog?** → Task seems small but has emotional load (shame, anxiety, confrontation)
   - **Too vague?** → Needs decomposition into concrete micro-steps
   - **Wrong estimate?** → Spoon cost was underestimated
   - **Blocked?** → Depends on something/someone else
   - **Not actually important?** → Should be 💤 Someday/Maybe or ❌ Cancelled

**Conversation flow:**
```
🔧 Task Surgery: [task name]

This task has been overdue for [X] days. Let's figure out what's going on.

1. When you think about doing this task, what's the first feeling? (dread? confusion? meh?)
2. Can you describe the FIRST physical action needed?
3. Is something else blocking this? (waiting on someone, missing info, need to be somewhere?)
```

**Based on diagnosis, act:**
- **Hidden frog:** Relabel with 🐸, acknowledge the emotional weight, apply micro-commitment strategy
- **Too vague:** Decompose using `omnifocus-inbox` Step 5 patterns (Frog Decomposition, Phone Call Sandwich, etc.) + `add_subtask.js` for the hierarchy
- **Wrong estimate:** Update spoon cost tag, reschedule appropriately
- **Blocked:** Add `⏸️ blocked` or `⏸️ waiting:*` tag, defer until unblocked
- **Not important:** Offer to defer (💤) or cancel (❌) — "It's okay to let go of things"

---

## Spoon Budget Rules

The taxonomy defines ~20🥄/day baseline. The forecast tracks this:

| Situation | Action |
|-----------|--------|
| Planned < 15🥄 | ✅ Healthy load — room for unexpected |
| Planned 15-20🥄 | 🟡 Full day — no room for surprises |
| Planned 20-25🥄 | 🟠 Over budget — need to triage |
| Planned > 25🥄 | 🔴 Unsustainable — MUST drop things |
| Many "untagged" tasks | 💡 Suggest adding spoon estimates |

**Never plan more than 1-2 🐸 tasks per day.** If multiple frogs are "due today", help Max pick the most consequential one and defer/reschedule the others.

---

## Drag Detection

The script auto-detects tasks overdue 3+ days and returns `dragAlerts` in meta.

| Days Overdue | Severity | Action |
|-------------|----------|--------|
| 3-6 days | 🟡 Warning | Mention in forecast, suggest: "Need to break this down?" |
| 7+ days | 🔴 Critical | Trigger Task Surgery mode, this task needs intervention |
| 14+ days | ⚫ Chronic | Ask: "Is this still relevant? Should we 💤 or ❌ it?" |

---

## Calendar Integration

Always combine OmniFocus forecast with calendar events for a complete picture:

```bash
export GOG_ACCOUNT=max@boettinger.media
DATE=$(date +%Y-%m-%d)
gog calendar events max@boettinger.media \
  --from "${DATE}T00:00:00+01:00" \
  --to "${DATE}T23:59:59+01:00"
```

Calendar events = hard blocks (non-negotiable time). Tasks must fit around them.

---

## Integration with Other Skills

| Need | Skill | When |
|------|-------|------|
| Add new task from forecast context | `omnifocus-inbox` | "Oh I also need to..." during forecast |
| Break down a task into sub-steps | `omnifocus` (`add_subtask.js`) | Task surgery, decomposition, 📦→🗂️→👣 |
| Complete a task | `omnifocus` (`complete_task.js`) | After finishing a task |
| Update task properties | `omnifocus` (`update_task.js`) | Reschedule, re-flag, add notes |
| Apply/manage tags | `omnifocus-tags` (`apply_tag.js`, `list_tags.js`) | Tag operations during task surgery. All `--tag` flags use strict lookup. |
| Set time estimates | `omnifocus` (`set_estimated_time.js`) | During planning or task surgery |
| Estimate & prioritize | `omnifocus-plan` | When MITs need discussion |
| Block time on calendar | `calendar-blocking` | After picking MITs |
| Morning delivery | `morning-briefing` | Forecast data feeds into morning cron |

---

## AuDHD Coaching Principles

**ALL strategies MUST be verified in `references/audhd/`** (see `index.md` for file map). Consult the relevant domain file before applying a strategy. Don't invent pseudoscience.

### Key Strategies for Forecast Context:

| Strategy | Application in Forecast | Reference |
|----------|------------------------|-----------|
| Implementation Intentions | "What Next?" — frame as "When [state], I will [action]" | `references/audhd/task-execution.md` |
| Micro-commitments | Task initiation — "Just 2 minutes, then you can stop" | `references/audhd/task-execution.md` |
| Body Doubling | "I'm here while you work — check in when done or stuck" | `references/audhd/task-execution.md` |
| Time Blindness | State estimates concretely: "~20min — one TV episode" | `references/audhd/task-execution.md` |
| Decision Fatigue | ALWAYS suggest ONE task, never a list of 5 | `references/audhd/energy-capacity.md` |
| Planning Fallacy | Apply +40-50% buffer to all estimates | `references/audhd/task-execution.md` |

### What NOT to Do:
- ❌ "Just start" — unhelpful for exec dysfunction
- ❌ Long lists of options — triggers choice paralysis
- ❌ Shame for uncompleted tasks — "couldn't" ≠ "didn't want to"
- ❌ Overload planning — more than 3 MITs is unrealistic
- ❌ Ignore energy state — a frog after lunch is a recipe for shutdown
- ❌ State AuDHD strategies without verification — check reference files first

---

## Quick Reference: Common Triggers

| Max says | Mode | Action |
|----------|------|--------|
| "forecast" / "was steht an?" / "what's today?" | 🌅 Morning | Full forecast |
| "what next?" / "was jetzt?" / "I'm stuck" | 🎯 What Next | One task suggestion |
| "how am I doing?" / "check-in" / "progress" | 📊 Check-in | Progress review |
| "shutdown" / "Feierabend" / "done for today" | 🌙 Shutdown | End-of-day ritual |
| "this task won't die" / "I keep avoiding X" | 🔧 Surgery | Diagnose stuck task |
| "add [task]" / brain dump during forecast | → `omnifocus-inbox` | Route to inbox skill |
| "block my calendar" / "schedule this" | → `calendar-blocking` | Route to blocking skill |
| "how long will X take?" / "estimate" | → `omnifocus-plan` | Route to planning skill |

---

## Technical Notes

- Script computes today's date internally — never pass dates as arguments
- Batch property access = fast (single Apple Event per property type)
- `deferDate` in OmniFocus = "don't show until this date" — tasks deferred to today just "appeared"
- Spoon costs parsed from task name emoji AND OmniFocus tags
- `daysOverdue` is negative for upcoming tasks (e.g., -3 = due in 3 days)
- `estimatedMinutes` may be null — suggest adding estimates for unestimated tasks
