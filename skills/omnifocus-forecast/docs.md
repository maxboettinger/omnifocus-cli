# Noridoc: omnifocus-forecast

Path: @/omnifocus-forecast

### Overview

This is a behavioral/protocol skill with no scripts of its own. It defines five interaction modes that together form the daily command center for task execution: Morning Forecast, What Next, Check-in, Shutdown Ritual, and Task Surgery. All modes pull live data from `@/omnifocus/scripts/forecast.js` and apply AuDHD-aware coaching strategies (implementation intentions, micro-commitments, body doubling) to bridge the gap between having a task list and actually doing the tasks.

### How it fits into the larger codebase

```
                  ┌──────────────────┐
                  │ morning-briefing │ (cron consumer)
                  └───────┬──────────┘
                          │ feeds forecast data
                          ▼
┌────────────┐    ┌───────────────────┐    ┌──────────────────┐
│omnifocus-  │◄───│ omnifocus-forecast│───►│ calendar-blocking│
│   inbox    │    │ (this skill)      │    └──────────────────┘
└────────────┘    └───────┬───────────┘
   captures new           │ reads from / writes to
   tasks mid-flow         ▼
              ┌──────────────────────┐
              │   omnifocus-tasks    │ (documentation)
              └───────┬───────────────┘
                      │
                      ▼
              ┌──────────────────────┐
              │   omnifocus (core)   │
              │  forecast.js         │
              │  complete_task.js    │
              │  update_task.js      │
              │  add_subtask.js      │
              └──────────┬───────────┘
                         │ governed by
                         ▼
              ┌──────────────────────┐
              │ taxonomy-reference.md│
              └──────────────────────┘
```

This skill is the primary **read-and-act** layer over the OmniFocus system. It consumes `forecast.js` output (the categorized JSON with overdue, due_today, deferred_today, planned_today, flagged, upcoming, and available_next buckets) and dispatches modifications back through `@/omnifocus-tasks` documented operations, which execute via core `@/omnifocus/scripts/`. It routes to `@/omnifocus-inbox` when captures arise mid-conversation, to `@/omnifocus-plan` for estimation discussions, and to `@/calendar-blocking` when time-blocking is needed. The `@/morning-briefing` cron skill also draws on this same forecast data for its automated daily delivery.

Calendar integration uses the `gog` CLI (Google Calendar) to overlay hard time blocks on top of task data, treating calendar events as non-negotiable constraints that tasks must fit around.

### Core Implementation

The skill is entirely defined in `SKILL.md` as a behavioral protocol. The five modes activate based on natural language triggers (English and German):

| Mode | Triggers | Primary Action |
|------|----------|----------------|
| Morning Forecast | "forecast", "was steht an?" | Run `forecast.js 5 --include-flagged`, pull calendar via `gog`, present categorized view with spoon budget, ask for MITs |
| What Next | "what next?", "was jetzt?", "I'm stuck" | Run forecast with `--include-available`, energy-match by time of day, present exactly ONE task with a micro-start action |
| Check-in | "check-in", "how am I doing?" | Refresh forecast, compare to morning MITs, recalculate remaining spoon budget |
| Shutdown Ritual | "shutdown", "Feierabend" | Review done vs. planned, handle carry-forward by deferring or rescheduling, preview tomorrow, capture open loops |
| Task Surgery | "this task won't die", drag alert triggered | Diagnose stuck tasks through five lenses: hidden frog, too vague, wrong estimate, blocked, or not important |

The spoon budget system tracks planned spoon costs against a ~20/day baseline. The forecast script returns a `meta.spoonBudget` field and `meta.dragAlerts` for tasks overdue 3+ days. The skill defines escalation tiers for both overload (healthy / full / over / unsustainable) and drag (warning at 3-6 days, critical at 7+, chronic at 14+).

Energy matching in "What Next" mode maps time-of-day windows to task energy levels: high-energy tasks (frogs) before noon, medium after lunch, low-energy or recharging in the afternoon.

### Things to Know

The priority triage order is explicit and fixed: P1 fixed > P1 firm > P2 fixed > overdue > due-today > flagged > deferred-today. This determines which single task gets surfaced in "What Next" mode.

The `references/audhd-concepts.md` file is referenced as a mandatory verification source for coaching strategies, but it does not currently exist in the repository. The AuDHD strategies (implementation intentions, micro-commitments, body doubling, time blindness compensation, decision fatigue mitigation, planning fallacy buffers) are documented inline in the SKILL.md itself.

The "What Next" mode enforces a strict single-task-only rule. Presenting multiple options is explicitly forbidden because choice triggers paralysis -- this is a core AuDHD accommodation, not a simplification.

Task Surgery uses operations documented in `@/omnifocus-tasks` (implemented via `@/omnifocus/scripts/add_subtask.js`) to decompose vague tasks into the taxonomy's nested hierarchy (Package > Task > Step). It can also reclassify tasks as Someday/Maybe or Cancelled, add blocked/waiting tags, or update spoon cost estimates using `update_task.js`.

Created and maintained by Nori.
