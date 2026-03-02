---
name: omnifocus-plan
description: AuDHD-aware task discussion and time estimation. Helps prioritize tasks, estimate durations realistically, and prepare for time-blocking.
---

# OmniFocus Planning (AuDHD-Aware)

Conversational skill for discussing, estimating, and prioritizing tasks before calendar blocking.

## When to Use

- Daily/weekly planning sessions
- Before time-blocking calendar
- When overwhelmed by task list
- When estimates feel unrealistic

## Taxonomy & Tags

Before planning ANY task, review [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md) for:
- Emoji decoration chain and spoon budget (~20🥄/day baseline)
- Time estimation buffers (ADHD-buffered)
- Task decomposition hierarchy (👣→🗂️→📦→🧰)
- Time units: Unit=45min, Session=90min, Slots=Morning/Noon/Afternoon

## Core Principles (AuDHD-Adapted)

### 1. Task Decomposition
If a task takes >45min or feels heavy, it's probably multiple tasks:
- "Is this one action or secretly three?"
- Break into sub-tasks until each is <30min
- Each sub-task = one clear physical/mental action

### 2. Energy Matching
Match task type to energy state:
| Energy Level | Good For | Avoid |
|--------------|----------|-------|
| High | Deep work, creative, complex decisions | Admin, email |
| Medium | Meetings, collaborative work, planning | High-stakes creative |
| Low | Admin, organizing, routine tasks | Anything requiring focus |

### 3. Transition Tax
Account for context-switching cost:
- Same-context tasks: +5min between
- Different-context tasks: +15min between
- Location change: +30min minimum

### 4. Realistic Daily Capacity
For AuDHD, sustainable focused work:
- **Deep work:** 3-4 hours max per day
- **Total productive:** 5-6 hours max
- **Buffer for unexpected:** 20% of day

## Planning Session Flow

### Step 1: Gather Context
```bash
osascript -l JavaScript skills/omnifocus/scripts/list_tasks.js available 20
osascript -l JavaScript skills/omnifocus/scripts/list_tasks.js due-soon
osascript -l JavaScript skills/omnifocus/scripts/list_tasks.js flagged
```

### Step 2: Query OpenMemory
```bash
omem search "current energy"
omem search "recent sleep"
omem search "upcoming commitments"
```

### Step 3: Discussion Questions
Ask the human:
1. "How's your energy today? (1-10)"
2. "Any hard deadlines I should know about?"
3. "What would make today feel successful?"
4. "Any tasks you're avoiding? (Let's address those)"

### Step 4: Estimate Together
For each priority task:
1. State initial estimate
2. Apply ADHD buffer (see [Taxonomy Reference](../omnifocus/references/taxonomy-reference.md#time-estimation-adhd-buffered))
3. Check: "Does X minutes feel right for [task]?"
4. Adjust based on feedback
5. Update OmniFocus:
```bash
osascript -l JavaScript skills/omnifocus/scripts/set_estimated_time.js "task-id" MINUTES
```

### Step 5: Prioritize
Use the "3 MITs" (Most Important Tasks) framework:
- Pick max 3 tasks that MUST happen today
- Everything else is bonus
- Flag MITs in OmniFocus

## Output Format

After planning, provide:
```
Today's Plan

MITs (Must Do):
1. [Task] — [X]min (energy: high)
2. [Task] — [X]min (energy: medium)
3. [Task] — [X]min (energy: low)

If Time Permits:
- [Task] — [X]min
- [Task] — [X]min

Total focused time: [X]h [X]min
Recommended start: [time] (based on energy pattern)

Ready to block these on calendar?
```

## Anti-Patterns to Avoid

- Don't schedule 8 hours of focused work
- Don't ignore transition time
- Don't let "quick" tasks stay unestimated
- Don't plan without checking energy state
- Don't skip the MIT prioritization

## Related Skills

- `omnifocus` — Task data source (CRUD layer). See [Available Scripts](../omnifocus/references/taxonomy-reference.md#available-scripts).
- `omnifocus-forecast` — Daily execution (uses planning output for MITs, energy matching)
- `omnifocus-inbox` — Task creation, structuring, and decomposition (phrasing, breakdown, decoration)
- `omnifocus-inbox` — Capture mechanism for new tasks
- `calendar-blocking` — Takes output, creates events
- `openmemory` — Personal context and patterns
