#!/usr/bin/env osascript -l JavaScript

// List tasks from OmniFocus with standardized full output
//
// Usage:
//   osascript -l JavaScript list_tasks.js [filter] [limit]
//
// Filters:
//   inbox       Inbox tasks (default limit: 500)
//   available   Available (unblocked) tasks (default)
//   flagged     Flagged tasks
//   due-soon    Due within 3 days
//   overdue     Past due
//   all         All incomplete tasks
//
// Default: available tasks (limit 20), inbox defaults to 500
//
// PERFORMANCE: Inbox uses batch property access (single Apple Event per property)
// to handle 200+ items in seconds. Other filters use full output format.
//
// Returns: JSON array of tasks with full metadata

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    var filter = args.length > 0 ? args[0] : "available";
    var limit = args.length > 1 ? parseInt(args[1]) : (filter === "inbox" ? 500 : 20);

    if (filter === "inbox") {
        return listInboxBatch(doc, limit);
    }

    return listFiltered(doc, filter, limit);
}

// ── Batch inbox listing (performant) ─────────────────────────────

function listInboxBatch(doc, limit) {
    // Batch property access for performance (one Apple Event per property)
    var inbox = doc.inboxTasks;
    var names = inbox.name();
    var ids = inbox.id();
    var notes = inbox.note();
    var dueDates = inbox.dueDate();
    var deferDates = inbox.deferDate();
    var flagged = inbox.flagged();
    var estimates = inbox.estimatedMinutes();
    var completed = inbox.completed();

    // plannedDate batch (OmniFocus 4.7+)
    var plannedDates;
    try { plannedDates = inbox.plannedDate(); } catch(e) { plannedDates = []; }

    var tasks = inbox();
    var count = Math.min(names.length, limit);
    var results = [];

    for (var i = 0; i < count; i++) {
        if (completed[i]) continue;

        var task = tasks[i];

        // Per-task calls (only for the limited result set)
        var tagNames = [];
        try { tagNames = task.tags().map(function(t) { return t.name(); }); } catch(e) {}

        var repetition = null;
        try {
            var rr = task.repetitionRule();
            if (rr) {
                var method = null;
                try { method = rr.method(); } catch(e2) {}
                repetition = { rule: rr.recurrenceString(), method: method };
            }
        } catch(e) {}

        var sequential = false;
        try { sequential = task.sequential(); } catch(e) {}

        var childCount = 0;
        try { childCount = task.tasks().length; } catch(e) {}

        var creationDate = null;
        try { var cd = task.creationDate(); if (cd) creationDate = cd.toISOString(); } catch(e) {}

        var modificationDate = null;
        try { var md = task.modificationDate(); if (md) modificationDate = md.toISOString(); } catch(e) {}

        var planned = plannedDates.length > i ? plannedDates[i] : null;

        results.push({
            name: names[i],
            id: ids[i],
            note: notes[i] || "",
            dueDate: dueDates[i] ? dueDates[i].toISOString() : null,
            deferDate: deferDates[i] ? deferDates[i].toISOString() : null,
            plannedDate: planned ? planned.toISOString() : null,
            effectiveDueDate: dueDates[i] ? dueDates[i].toISOString() : null,
            effectiveDeferDate: deferDates[i] ? deferDates[i].toISOString() : null,
            effectivePlannedDate: planned ? planned.toISOString() : null,
            flagged: flagged[i],
            effectiveFlagged: flagged[i],
            estimatedMinutes: estimates[i] || null,
            completed: completed[i],
            completionDate: null,
            creationDate: creationDate,
            modificationDate: modificationDate,
            sequential: sequential,
            inInbox: true,
            blocked: false,
            project: "Inbox",
            parentTask: null,
            tags: tagNames,
            repetitionRule: repetition,
            childCount: childCount
        });
    }

    return JSON.stringify(results, null, 2);
}

// ── Filtered listing with full output ────────────────────────────

function listFiltered(doc, filter, limit) {
    var now = new Date();
    var threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    var allTasks = doc.flattenedTasks();
    var results = [];

    for (var i = 0; i < allTasks.length && results.length < limit; i++) {
        var task = allTasks[i];

        if (task.completed()) continue;

        var include = false;

        switch (filter) {
            case "flagged":
                include = task.flagged();
                break;
            case "available":
                var isBlocked = false;
                try { isBlocked = task.blocked(); } catch(e) {}
                include = !isBlocked;
                break;
            case "due-soon":
                var dueDate = task.dueDate();
                include = dueDate && dueDate < threeDaysFromNow && dueDate >= now;
                break;
            case "overdue":
                var taskDueDate = task.dueDate();
                include = taskDueDate && taskDueDate < now;
                break;
            case "all":
                include = true;
                break;
            default:
                return JSON.stringify({ error: "Unknown filter: " + filter });
        }

        if (include) {
            results.push(lib.formatTaskFull(task));
        }
    }

    return JSON.stringify(results, null, 2);
}
