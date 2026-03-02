#!/usr/bin/env osascript -l JavaScript

// Complete (or uncomplete) an OmniFocus task
//
// Usage:
//   osascript -l JavaScript complete_task.js "Task name"
//   osascript -l JavaScript complete_task.js --id "taskId"
//   osascript -l JavaScript complete_task.js "Task name" --incomplete
//
// Task lookup (first positional arg or --id):
//   First positional arg     Finds by: ID → exact name → substring → disambiguate
//   --id "taskId"            Find by OmniFocus task ID (most reliable)
//
// Options:
//   --incomplete             Mark task as incomplete instead of complete
//
// Returns: JSON { ok, id, name, action, task: { full task object } }
//
// Examples:
//   osascript -l JavaScript complete_task.js "Buy groceries"
//   osascript -l JavaScript complete_task.js --id "abc123"
//   osascript -l JavaScript complete_task.js "Weekly review" --incomplete

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
            usage: 'complete_task.js "Task name" [--incomplete] or --id "taskId" [--incomplete]'
        });
    }

    var opts = lib.parseArgs(args, {
        query:      true,
        id:         'string',
        incomplete: 'boolean'
    });

    if (!opts.query && !opts.id) {
        return lib.err("Task identifier required. Provide task name or use --id.");
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
        findResult = lib.findTaskByQuery(doc, opts.query, { searchCompleted: opts.incomplete });
    }

    if (findResult.error) {
        return lib.err(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    }

    var task = findResult.task;
    var action;

    try {
        if (opts.incomplete) {
            try { task.markIncomplete(); } catch(e) { task.completed = false; }
            action = "uncompleted";
        } else {
            try { task.markComplete(); } catch(e) { task.completed = true; }
            action = "completed";
        }
    } catch(e) {
        return lib.err("Operation failed: " + e.message);
    }

    return JSON.stringify({
        ok: true,
        id: task.id(),
        name: task.name(),
        action: action,
        task: lib.formatTaskFull(task)
    });
}
