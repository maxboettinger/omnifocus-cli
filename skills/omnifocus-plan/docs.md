# Noridoc: omnifocus-plan

Path: @/omnifocus-plan

### Overview

AuDHD-aware planning and estimation skill that defines the behavioral protocol for daily and weekly task planning sessions. It is a pure protocol skill with no scripts of its own -- it orchestrates a conversational flow that reads task data from OmniFocus, discusses priorities with the user, applies ADHD-buffered time estimates, and produces a structured plan ready for calendar blocking.

### How it fits into the larger codebase

omnifocus-plan sits at the center of a pipeline that flows from task capture through to calendar execution:

```
omnifocus-create / omnifocus-inbox
        |
        v
   omnifocus-tasks (documentation)
        |
        v
   omnifocus (CRUD layer, scripts/)
        |
        v
  omnifocus-plan  <--- openmemory (energy/sleep context)
        |
        v
  calendar-blocking (gog CLI -> Google Calendar)
        |
        v
  omnifocus-forecast (daily execution, MITs, spoon tracking)
```

The skill reads task data using operations documented in `@/omnifocus-tasks` (calling `@/omnifocus/scripts/list_tasks.js` with filters `available`, `due-soon`, `flagged`) and writes estimates back via `set_estimated_time.js`. It queries `openmemory` for personal context like current energy levels and sleep quality. Its output -- a prioritized list of MITs with time estimates -- is consumed by `@/calendar-blocking` to create Google Calendar time blocks and by `@/omnifocus-forecast` for daily execution tracking.

The skill references `@/omnifocus/references/taxonomy-reference.md` as the single source of truth for time estimation buffers, spoon costs, task decomposition hierarchy, and the emoji decoration chain. It does not duplicate those tables.

### Core Implementation

The skill defines a 5-step planning session flow in `SKILL.md`:

1. **Gather Context** -- pull available, due-soon, and flagged tasks from OmniFocus via JXA scripts.
2. **Query OpenMemory** -- search for current energy, recent sleep, and upcoming commitments to inform capacity decisions.
3. **Discussion Questions** -- ask the user about energy level (1-10), hard deadlines, success criteria for the day, and avoided tasks.
4. **Estimate Together** -- for each priority task, state an initial estimate, apply the ADHD buffer from taxonomy-reference.md (ranging from +30% for 2h+ tasks to +200% for "5 minute" tasks), validate with the user, and write the estimate to OmniFocus via `set_estimated_time.js`.
5. **Prioritize with 3 MITs** -- select a maximum of three Most Important Tasks for the day; everything else is labeled as bonus.

The output format is a structured text block containing MITs with estimates and energy tags, optional bonus tasks, total focused time, and a recommended start time. The final prompt asks whether to proceed to calendar blocking.

### Things to Know

The skill encodes three AuDHD-specific capacity constraints that govern all planning decisions: realistic daily capacity is capped at 3-4 hours of deep work and 5-6 hours total productive time, with 20% of the day reserved as buffer for unexpected interruptions. Transition tax adds 5 minutes between same-context tasks, 15 minutes between different-context tasks, and 30 minutes for location changes. Energy matching rules map high energy to deep/creative work, medium energy to meetings and collaboration, and low energy to admin and routine -- scheduling a frog task during a low-energy window is explicitly flagged as an anti-pattern.

The skill was previously named `task-planning/` and was renamed to `omnifocus-plan/` for consistent `omnifocus-*` naming across the skill family.

Created and maintained by Nori.
