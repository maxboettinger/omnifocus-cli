#!/usr/bin/env osascript -l JavaScript

// Update an OmniFocus task — supports ALL writable fields
//
// Usage:
//   osascript -l JavaScript update_task.js "Task name" [options]
//   osascript -l JavaScript update_task.js --id "taskId" [options]
//
// Task lookup (first positional arg or --id):
//   First positional arg     Finds by: ID → exact name → substring → disambiguate
//   --id "taskId"            Find by OmniFocus task ID (most reliable)
//
// Options:
//   --name "new name"                    Rename the task
//   --note "text"                        Set/replace note
//   --note-append "text"                 Append to existing note
//   --due "YYYY-MM-DD" | clear           Set or clear due date (supports YYYY-MM-DDTHH:MM)
//   --defer "YYYY-MM-DD" | clear         Set or clear defer date
//   --planned "YYYY-MM-DD" | clear       Set or clear planned date (OmniFocus 4.7+)
//   --flag                               Flag the task
//   --unflag                             Unflag the task
//   --estimate N | clear                 Set or clear estimate (minutes)
//   --tag "name"                         Add tag (repeatable)
//   --remove-tag "name"                  Remove tag (repeatable)
//   --project "name"                     Move to project
//   --sequential                         Set children to sequential
//   --parallel                           Set children to parallel
//   --repeat "RRULE" | clear             Set or clear repetition (e.g. "FREQ=DAILY;INTERVAL=1")
//   --repeat-method "due-date|completion" Repeat method (default: due-date)
//   --complete                           Mark task complete
//   --incomplete                         Mark task incomplete
//
// Returns: JSON { ok, id, changes, task: { full task object } }
//
// Examples:
//   osascript -l JavaScript update_task.js "Buy groceries" --due "2026-03-01" --flag
//   osascript -l JavaScript update_task.js --id "abc123" --name "New name" --due clear
//   osascript -l JavaScript update_task.js "Review doc" --tag "🐸 Frog" --estimate 30
//   osascript -l JavaScript update_task.js --id "abc123" --planned "2026-02-10"
//   osascript -l JavaScript update_task.js --id "abc123" --planned clear

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
        return lib.err("Task identifier required", {
            usage: 'update_task.js "Task name" [options] or --id "taskId" [options]'
        });
    }

    var opts = lib.parseArgs(args, {
        query:        true,
        id:           'string',
        name:         'string',
        note:         'string',
        noteAppend:   'string',
        due:          'string',
        defer:        'string',
        planned:      'string',
        flag:         'boolean',
        unflag:       'boolean',
        estimate:     'intOrClear',
        tag:          'array',
        removeTag:    'array',
        project:      'string',
        sequential:   'boolean',
        parallel:     'boolean',
        repeat:       'string',
        repeatMethod: 'string',
        complete:     'boolean',
        incomplete:   'boolean'
    });
    opts.tags = opts.tag;
    opts.removeTags = opts.removeTag;

    if (!opts.query && !opts.id) {
        return lib.err("Task identifier required. Provide task name as first argument or use --id.");
    }

    var of = Application('OmniFocus');
    of.includeStandardAdditions = true;
    var doc = of.defaultDocument;

    // Find the task
    var findResult;
    if (opts.id) {
        var found = lib.findTaskById(doc, opts.id);
        if (!found) {
            return lib.err("Task not found with ID: " + opts.id);
        }
        findResult = { task: found };
    } else {
        findResult = lib.findTaskByQuery(doc, opts.query);
    }

    if (findResult.error) {
        return lib.err(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    }

    var task = findResult.task;
    var changes = [];

    try {
        // Complete / Incomplete (before other changes)
        if (opts.complete) {
            try { task.markComplete(); } catch(e) { task.completed = true; }
            changes.push("completed");
        }
        if (opts.incomplete) {
            try { task.markIncomplete(); } catch(e) { task.completed = false; }
            changes.push("marked incomplete");
        }

        // Rename
        if (opts.name !== null) {
            task.name = opts.name;
            changes.push("renamed → " + opts.name);
        }

        // Note
        if (opts.note !== null) {
            task.note = opts.note;
            changes.push("note set");
        }
        if (opts.noteAppend !== null) {
            var existing = task.note() || "";
            task.note = existing + (existing ? "\n" : "") + opts.noteAppend;
            changes.push("note appended");
        }

        // Apply standard properties (due, defer, planned, flag, unflag, estimate, sequential, parallel, repeat, tags, removeTags)
        var propChanges = lib.applyTaskProps(of, doc, task, opts);
        changes = changes.concat(propChanges);

        // Move to project (strict lookup - never creates)
        if (opts.project !== null) {
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
    } catch(e) {
        return JSON.stringify({ ok: false, error: "Update failed: " + e.message, changes: changes });
    }

    return JSON.stringify({
        ok: true,
        id: task.id(),
        changes: changes,
        task: lib.formatTaskFull(task)
    });
}
