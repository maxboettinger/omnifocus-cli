#!/usr/bin/env osascript -l JavaScript

// OmniFocus Forecast — Categorized task view for today + surrounding days
//
// Usage:
//   osascript -l JavaScript forecast.js [upcoming_days] [--include-flagged] [--include-available]
//
// PERFORMANCE: Uses batch property access (single Apple Event per property)
// instead of per-task access. Handles 2000+ tasks in seconds.
//
// Returns JSON with categorized buckets:
//   overdue        — due date < start of today
//   due_today      — due date = today
//   planned_today  — planned date = today (OmniFocus 4.7+ "Plan for Today")
//   deferred_today — defer date ≤ today AND not in other buckets (legacy/available today)
//   flagged        — flagged tasks not already in above buckets (--include-flagged)
//   upcoming       — due within next N days (default 3)
//   available_next — available unflagged tasks not in any bucket (--include-available, max 10)
//
// KEY DISTINCTION (OmniFocus 4.7+):
//   - deferDate: When a task BECOMES AVAILABLE (hidden until this date)
//   - plannedDate: When you PLAN to work on a task (task remains available, just scheduled)
//   "Planned Today" = tasks Max has scheduled for today, NOT tasks that just became available.
//
// Each task includes full metadata: name, id, note, dates, flags, project, tags,
//   estimatedMinutes, spoonCost, spoonEmoji, priority, rigidity, daysOverdue,
//   plannedDate, repetitionRule, sequential, creationDate, modificationDate

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    var upcomingDays = 3;
    var includeFlagged = false;
    var includeAvailable = false;

    for (var i = 0; i < args.length; i++) {
        if (args[i] === "--include-flagged") {
            includeFlagged = true;
        } else if (args[i] === "--include-available") {
            includeAvailable = true;
        } else {
            var parsed = parseInt(args[i]);
            if (!isNaN(parsed) && parsed > 0) upcomingDays = parsed;
        }
    }

    var of = Application("OmniFocus");
    var doc = of.defaultDocument;

    // ── Date boundaries (computed HERE, never stale) ──
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    var todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    var yesterdayEnd = new Date(todayStart.getTime() - 1);
    var upcomingEnd = new Date(todayStart);
    upcomingEnd.setDate(upcomingEnd.getDate() + upcomingDays);
    upcomingEnd.setHours(23, 59, 59, 999);
    var todayStr = now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");

    // ── Batch property access (one Apple Event per property = fast) ──
    var tasks = doc.flattenedTasks;
    var allCompleted = tasks.completed();
    var allDueDates = tasks.dueDate();
    var allDeferDates = tasks.deferDate();
    var allFlagged = tasks.flagged();
    var allNames = tasks.name();
    var allIds = tasks.id();
    var allNotes = tasks.note();

    var allEstimates;
    try { allEstimates = tasks.estimatedMinutes(); } catch(e) { allEstimates = []; }

    // OmniFocus 4.7+: Planned dates (when you PLAN to work on a task)
    var allPlannedDates;
    try { allPlannedDates = tasks.plannedDate(); } catch(e) { allPlannedDates = []; }

    var total = allCompleted.length;

    // ── First pass: categorize by index (fast, no per-task calls) ──
    var overdueIdx = [];
    var dueTodayIdx = [];
    var plannedTodayIdx = [];  // NEW: OmniFocus 4.7+ "Plan for Today"
    var deferredTodayIdx = [];
    var flaggedIdx = [];
    var upcomingIdx = [];
    var availableIdx = [];
    var seenIdx = {};

    for (var i = 0; i < total; i++) {
        if (allCompleted[i]) continue;

        var due = allDueDates[i];
        var defer = allDeferDates[i];
        var planned = allPlannedDates.length > i ? allPlannedDates[i] : null;
        var flagVal = allFlagged[i];

        // Skip if deferred to the future — unless it has a due/planned date that qualifies
        if (defer && defer > todayEnd && (!due || due > todayEnd) && (!planned || planned > todayEnd)) continue;

        // Bucket 1: Overdue
        if (due && due < todayStart) {
            overdueIdx.push(i);
            seenIdx[i] = true;
            continue;
        }

        // Bucket 2: Due today
        if (due && due >= todayStart && due <= todayEnd) {
            dueTodayIdx.push(i);
            seenIdx[i] = true;
            continue;
        }

        // Bucket 3: PLANNED for today (OmniFocus 4.7+ "Plan for Today")
        // This is the KEY bucket: tasks Max has SCHEDULED for today
        if (planned && planned >= todayStart && planned <= todayEnd && !seenIdx[i]) {
            plannedTodayIdx.push(i);
            seenIdx[i] = true;
            continue;
        }

        // Bucket 4: Deferred to TODAY specifically (legacy: became available today)
        if (defer && defer > yesterdayEnd && defer <= todayEnd && (!due || due > todayEnd)) {
            deferredTodayIdx.push(i);
            seenIdx[i] = true;
            continue;
        }

        // Bucket 5: Flagged
        if (includeFlagged && flagVal && !seenIdx[i]) {
            flaggedIdx.push(i);
            seenIdx[i] = true;
            continue;
        }

        // Bucket 6: Upcoming
        if (due && due > todayEnd && due <= upcomingEnd) {
            upcomingIdx.push(i);
            seenIdx[i] = true;
            continue;
        }

        // Bucket 7: Available next
        if (includeAvailable && !seenIdx[i] && availableIdx.length < 20) {
            if (!defer || defer <= todayEnd) {
                availableIdx.push(i);
                seenIdx[i] = true;
            }
        }
    }

    // ── Second pass: format only categorized tasks ──
    var taskRefs = doc.flattenedTasks();

    function formatByIndex(idx) {
        var task = taskRefs[idx];
        var name = allNames[idx];
        var due = allDueDates[idx];
        var defer = allDeferDates[idx];
        var planned = allPlannedDates.length > idx ? allPlannedDates[idx] : null;
        var est = allEstimates.length > idx ? allEstimates[idx] : null;

        // Per-task calls only for categorized tasks
        var project = null;
        try { var p = task.containingProject(); if (p) project = p.name(); } catch(e) {}

        var tagNames = [];
        try {
            var tgs = task.tags();
            for (var j = 0; j < tgs.length; j++) {
                tagNames.push(tgs[j].name());
            }
        } catch(e) {}

        // NEW: repetition rule
        var repetition = null;
        try {
            var rr = task.repetitionRule();
            if (rr) {
                var method = null;
                try { method = rr.method(); } catch(e2) {}
                repetition = { rule: rr.recurrenceString(), method: method };
            }
        } catch(e) {}

        // NEW: sequential
        var sequential = false;
        try { sequential = task.sequential(); } catch(e) {}

        // NEW: creation/modification dates
        var creationDate = null;
        try { var cd = task.creationDate(); if (cd) creationDate = cd.toISOString(); } catch(e) {}

        var modificationDate = null;
        try { var md = task.modificationDate(); if (md) modificationDate = md.toISOString(); } catch(e) {}

        // NEW: effective dates
        var effectiveDue = null;
        try { var ed = task.effectiveDueDate(); if (ed) effectiveDue = ed.toISOString(); } catch(e) {}

        var effectiveDefer = null;
        try { var edf = task.effectiveDeferDate(); if (edf) effectiveDefer = edf.toISOString(); } catch(e) {}

        // OmniFocus 4.7+: effectivePlannedDate (inherited planned date)
        var effectivePlanned = null;
        try { var ep = task.effectivePlannedDate(); if (ep) effectivePlanned = ep.toISOString(); } catch(e) {}

        var effectiveFlagged = allFlagged[idx];
        try { effectiveFlagged = task.effectiveFlagged(); } catch(e) {}

        // NEW: blocked
        var blocked = false;
        try { blocked = task.blocked(); } catch(e) {}

        // NEW: child count
        var childCount = 0;
        try { childCount = task.tasks().length; } catch(e) {}

        // NEW: parent task
        var parentTask = null;
        try { var pt = task.parentTask(); if (pt) parentTask = { id: pt.id(), name: pt.name() }; } catch(e) {}

        var spoonInfo = lib.parseSpoonCost(name, tagNames);
        var priority = lib.parsePriority(name, tagNames);
        var rigidity = lib.parseRigidity(name);

        var daysOverdue = null;
        if (due) {
            daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);
        }

        return {
            name: name,
            id: allIds[idx],
            note: allNotes[idx] || "",
            dueDate: due ? due.toISOString() : null,
            deferDate: defer ? defer.toISOString() : null,
            plannedDate: planned ? planned.toISOString() : null,  // OmniFocus 4.7+
            effectiveDueDate: effectiveDue,
            effectiveDeferDate: effectiveDefer,
            effectivePlannedDate: effectivePlanned,  // OmniFocus 4.7+
            flagged: allFlagged[idx],
            effectiveFlagged: effectiveFlagged,
            project: project || "Inbox",
            parentTask: parentTask,
            tags: tagNames,
            estimatedMinutes: est,
            sequential: sequential,
            blocked: blocked,
            repetitionRule: repetition,
            childCount: childCount,
            creationDate: creationDate,
            modificationDate: modificationDate,
            spoonCost: spoonInfo.cost,
            spoonEmoji: spoonInfo.emoji,
            priority: priority,
            rigidity: rigidity,
            daysOverdue: daysOverdue
        };
    }

    var overdue = overdueIdx.map(formatByIndex);
    var dueToday = dueTodayIdx.map(formatByIndex);
    var plannedToday = plannedTodayIdx.map(formatByIndex);  // NEW: OmniFocus 4.7+
    var deferredToday = deferredTodayIdx.map(formatByIndex);
    var flaggedTasks = flaggedIdx.map(formatByIndex);
    var upcoming = upcomingIdx.map(formatByIndex);
    var availableNext = availableIdx.slice(0, 10).map(formatByIndex);

    // Sort
    overdue.sort(function(a, b) { return lib.cmpDate(a.dueDate, b.dueDate); });
    dueToday.sort(function(a, b) { return lib.cmpDate(a.dueDate, b.dueDate); });
    plannedToday.sort(function(a, b) { return lib.cmpDate(a.plannedDate, b.plannedDate); });
    upcoming.sort(function(a, b) { return lib.cmpDate(a.dueDate, b.dueDate); });

    // ── Spoon budget ──
    // Planned today is the PRIMARY "today" bucket for spoon calculation
    var todayTasks = overdue.concat(dueToday).concat(plannedToday).concat(deferredToday);
    if (includeFlagged) todayTasks = todayTasks.concat(flaggedTasks);
    var totalSpoons = 0;
    var totalEstMin = 0;
    var spoonBreakdown = { "🐸": 0, "💥": 0, "🔋": 0, "🪫": 0, "🔌": 0, "untagged": 0 };

    for (var k = 0; k < todayTasks.length; k++) {
        var t = todayTasks[k];
        if (t.spoonCost !== null && t.spoonCost > 0) {
            totalSpoons += t.spoonCost;
        } else if (t.spoonCost !== null && t.spoonCost < 0) {
            totalSpoons += t.spoonCost;
        } else {
            spoonBreakdown["untagged"]++;
        }
        if (t.spoonEmoji && spoonBreakdown.hasOwnProperty(t.spoonEmoji)) {
            spoonBreakdown[t.spoonEmoji]++;
        }
        if (t.estimatedMinutes) totalEstMin += t.estimatedMinutes;
    }

    // ── Drag detection ──
    var dragAlerts = [];
    for (var m = 0; m < overdue.length; m++) {
        if (overdue[m].daysOverdue >= 3) {
            dragAlerts.push({
                name: overdue[m].name,
                id: overdue[m].id,
                daysOverdue: overdue[m].daysOverdue,
                suggestion: overdue[m].daysOverdue >= 7
                    ? "Overdue 7+ days — needs re-evaluation: still relevant? needs decomposition? hidden frog?"
                    : "Overdue 3+ days — consider: wrong spoon estimate? needs breakdown? blocked on something?"
            });
        }
    }

    return JSON.stringify({
        meta: {
            generatedAt: now.toISOString(),
            today: todayStr,
            upcomingDays: upcomingDays,
            spoonBudget: {
                baseline: 20,
                planned: totalSpoons,
                remaining: 20 - totalSpoons,
                overBudget: totalSpoons > 20,
                breakdown: spoonBreakdown
            },
            totalEstimatedMinutes: totalEstMin,
            counts: {
                overdue: overdue.length,
                dueToday: dueToday.length,
                plannedToday: plannedToday.length,  // OmniFocus 4.7+: "Plan for Today"
                deferredToday: deferredToday.length,
                flagged: flaggedTasks.length,
                upcoming: upcoming.length,
                availableNext: availableNext.length
            },
            dragAlerts: dragAlerts
        },
        overdue: overdue,
        due_today: dueToday,
        planned_today: plannedToday,  // OmniFocus 4.7+: Tasks SCHEDULED for today
        deferred_today: deferredToday,  // Legacy: Tasks that BECAME AVAILABLE today
        flagged: flaggedTasks,
        upcoming: upcoming,
        available_next: availableNext
    }, null, 2);
}

