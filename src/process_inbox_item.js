#!/usr/bin/env osascript -l JavaScript

// Process an OmniFocus inbox item: rename, move, tag, date, estimate, flag, repeat, delete
//
// Usage:
//   osascript -l JavaScript process_inbox_item.js <ID> [OPTIONS]
//
// Options:
//   --name "new name"                    Rename the task
//   --note "text"                        Set/replace note
//   --note-append "text"                 Append to existing note
//   --project "Project Name"             Move to project (searches by name/substring)
//   --tag "Tag Name"                     Add tag (repeatable)
//   --remove-tag "Tag Name"              Remove tag (repeatable)
//   --due "YYYY-MM-DD" | clear           Set or clear due date
//   --defer "YYYY-MM-DD" | clear         Set or clear defer date
//   --planned "YYYY-MM-DD" | clear       Set or clear planned date (OmniFocus 4.7+)
//   --estimate N | clear                 Set or clear estimate in minutes
//   --flag                               Flag the task
//   --unflag                             Unflag the task
//   --sequential                         Set children to sequential
//   --parallel                           Set children to parallel
//   --repeat "RRULE" | clear             Set or clear repetition rule
//   --repeat-method "due-date|completion" Repeat method (default: due-date)
//   --complete                           Mark as complete
//   --delete                             Remove from OmniFocus entirely
//   --dry-run                            Preview changes without applying
//
// Returns: JSON { ok, id, changes, task: { full task object } }
//
// Examples:
//   osascript -l JavaScript process_inbox_item.js "abc123" --project "Work" --tag "🐸 Frog" --due "2026-03-01"
//   osascript -l JavaScript process_inbox_item.js "xyz789" --repeat "FREQ=DAILY;INTERVAL=1" --repeat-method due-date
//   osascript -l JavaScript process_inbox_item.js "abc123" --sequential --estimate 30
//   osascript -l JavaScript process_inbox_item.js "abc123" --planned "2026-02-10"

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    if (args.length === 0) {
        return lib.err("Task ID required", {
            usage: "process_inbox_item.js <ID> [--name ...] [--project ...] [--tag ...] [--due ...] [--defer ...] [--planned ...] [--estimate N] [--flag] [--sequential] [--repeat RRULE] [--repeat-method method] [--complete] [--delete]"
        });
    }

    var of = Application('OmniFocus');
    of.includeStandardAdditions = true;
    var doc = of.defaultDocument;

    var taskId = args[0];

    // Parse remaining args with schema
    var opts = lib.parseArgs(args.slice(1), {
        name:         'string',
        note:         'string',
        noteAppend:   'string',
        project:      'string',
        tag:          'array',
        removeTag:    'array',
        due:          'string',
        defer:        'string',
        planned:      'string',
        estimate:     'intOrClear',
        flag:         'boolean',
        unflag:       'boolean',
        sequential:   'boolean',
        parallel:     'boolean',
        repeat:       'string',
        repeatMethod: 'string',
        complete:     'boolean',
        delete:       'boolean',
        dryRun:       'boolean'
    });
    opts.tags = opts.tag;
    opts.removeTags = opts.removeTag;
    opts.doDelete = opts["delete"];

    // Find the task by ID (search inbox first, then all tasks)
    var task = null;
    try {
        var inboxTasks = doc.inboxTasks();
        for (var i = 0; i < inboxTasks.length; i++) {
            if (inboxTasks[i].id() === taskId) {
                task = inboxTasks[i];
                break;
            }
        }
        if (!task) {
            task = lib.findTaskById(doc, taskId);
        }
    } catch (e) {
        return lib.err("Error searching for task: " + e.message);
    }

    if (!task) {
        return lib.err("Task not found with ID: " + taskId);
    }

    var originalName = task.name();

    // Dry run: report what would happen
    if (opts.dryRun) {
        var planned = [];
        if (opts.name) planned.push("rename → " + opts.name);
        if (opts.note !== null) planned.push("set note");
        if (opts.noteAppend) planned.push("append note");
        if (opts.project) planned.push("move → " + opts.project);
        if (opts.tags.length) planned.push("add tags: " + opts.tags.join(", "));
        if (opts.removeTags.length) planned.push("remove tags: " + opts.removeTags.join(", "));
        if (opts.due) planned.push(opts.due === "clear" ? "clear due date" : "due → " + opts.due);
        if (opts.defer) planned.push(opts.defer === "clear" ? "clear defer date" : "defer → " + opts.defer);
        if (opts.planned) planned.push(opts.planned === "clear" ? "clear planned date" : "planned → " + opts.planned);
        if (opts.estimate !== null) planned.push(opts.estimate === "clear" ? "clear estimate" : "estimate → " + opts.estimate + "min");
        if (opts.flag) planned.push("flag");
        if (opts.unflag) planned.push("unflag");
        if (opts.sequential) planned.push("set sequential");
        if (opts.parallel) planned.push("set parallel");
        if (opts.repeat) planned.push(opts.repeat === "clear" ? "clear repetition" : "repeat → " + opts.repeat);
        if (opts.complete) planned.push("complete");
        if (opts.doDelete) planned.push("DELETE");
        return JSON.stringify({ ok: true, dryRun: true, id: taskId, name: originalName, planned: planned });
    }

    // Delete
    if (opts.doDelete) {
        try {
            of.delete(task);
            return JSON.stringify({ ok: true, id: taskId, name: originalName, action: "deleted" });
        } catch (e) {
            return lib.err("Delete failed: " + e.message);
        }
    }

    var changes = [];

    try {
        // Complete
        if (opts.complete) {
            try { task.markComplete(); } catch(e) { task.completed = true; }
            changes.push("completed");
        }

        // Rename
        if (opts.name) {
            task.name = opts.name;
            changes.push("renamed → " + opts.name);
        }

        // Note
        if (opts.note !== null) {
            task.note = opts.note;
            changes.push("note set");
        }
        if (opts.noteAppend) {
            var existing = task.note() || "";
            task.note = existing + (existing ? "\n" : "") + opts.noteAppend;
            changes.push("note appended");
        }

        // Move to project (strict lookup - never creates)
        if (opts.project) {
            var projectLookup = lib.findExistingProject(doc, opts.project);
            if (projectLookup.project) {
                task.assignedContainer = projectLookup.project;
                changes.push("moved to project: " + projectLookup.project.name());
            } else {
                var errorMsg = "project lookup failed: " + projectLookup.error;
                if (projectLookup.candidates) {
                    errorMsg += " — candidates: " + projectLookup.candidates.join(", ");
                }
                changes.push(errorMsg);
            }
        }

        // Apply standard properties (due, defer, planned, flag, unflag, estimate, sequential, parallel, repeat, tags, removeTags)
        var propChanges = lib.applyTaskProps(of, doc, task, opts);
        changes = changes.concat(propChanges);
    } catch (e) {
        return JSON.stringify({ ok: false, error: "Update failed: " + e.message, changes: changes });
    }

    return JSON.stringify({
        ok: true,
        id: taskId,
        changes: changes,
        task: lib.formatTaskFull(task)
    });
}
