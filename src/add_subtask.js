#!/usr/bin/env osascript -l JavaScript

// Add a sub-task (child task) under an existing OmniFocus task
// Supports full nesting: sub-tasks of sub-tasks at any depth
//
// Usage:
//   osascript -l JavaScript add_subtask.js "Subtask name" --parent "Parent name or ID" [options]
//
// Required:
//   "Subtask name"                       First positional argument — the new child task name
//   --parent "name or ID"                Parent task to nest under (by exact name, ID, or substring)
//   --parent-id "ID"                     Alternative: parent by OmniFocus task ID (most reliable)
//
// Options:
//   --note "text"                        Task note / context
//   --due "YYYY-MM-DD"                   Due date (or "YYYY-MM-DDTHH:MM" for time)
//   --defer "YYYY-MM-DD"                 Defer/start date
//   --planned "YYYY-MM-DD"              Planned date (OmniFocus 4.7+ "Plan for Today")
//   --tag "Tag Name"                     Add tag (repeatable for multiple tags)
//   --flag                               Flag the task
//   --estimate N                         Estimated minutes (integer)
//   --sequential                         Set children to sequential
//   --repeat "RRULE"                     Repetition rule (e.g. "FREQ=DAILY;INTERVAL=1")
//   --repeat-method "due-date|completion" Repeat method (default: due-date)
//
// Parent resolution order:
//   1. --parent-id: direct ID lookup (fastest, unambiguous)
//   2. --parent: tries ID first, then exact name match, then substring match
//   3. If multiple matches found, returns error with candidates for disambiguation
//
// Returns: JSON { ok, id, name, task: { full task object }, parent: { id, name, project } }
//
// Examples:
//   osascript -l JavaScript add_subtask.js "☑️🪫 Scan documents" --parent "🗂️ Prepare tax return" --tag "🏡 Daheim" --estimate 10
//   osascript -l JavaScript add_subtask.js "☑️🪫 Upload PDF" --parent-id "abc123XYZ" --estimate 5
//   osascript -l JavaScript add_subtask.js "Daily check" --parent "Routines" --repeat "FREQ=DAILY;INTERVAL=1"

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
        return lib.err("Task name required", {
            usage: 'add_subtask.js "Subtask name" --parent "Parent name or ID" [--note text] [--due YYYY-MM-DD] [--defer YYYY-MM-DD] [--planned YYYY-MM-DD] [--tag name]... [--flag] [--estimate N] [--sequential] [--repeat RRULE] [--repeat-method method]'
        });
    }

    var opts = lib.parseArgs(args, {
        taskName:     true,
        parent:       'string',
        parentId:     'string',
        note:         'string',
        due:          'string',
        defer:        'string',
        planned:      'string',
        tag:          'array',
        flag:         'boolean',
        estimate:     'int',
        sequential:   'boolean',
        repeat:       'string',
        repeatMethod: 'string'
    });
    opts.tags = opts.tag;

    if (!opts.taskName) {
        return lib.err("Task name required as first argument");
    }

    if (!opts.parent && !opts.parentId) {
        return lib.err("Parent task required. Use --parent \"name or ID\" or --parent-id \"ID\"");
    }

    var of = Application('OmniFocus');
    of.includeStandardAdditions = true;
    var doc = of.defaultDocument;

    // Find parent task
    var parentTask;

    if (opts.parentId) {
        parentTask = lib.findTaskById(doc, opts.parentId);
        if (!parentTask) {
            return lib.err("Parent task not found by ID: " + opts.parentId);
        }
    } else {
        var result = lib.findTaskByQuery(doc, opts.parent, { idFlag: "--parent-id" });
        if (result.error) {
            return lib.err(result.error, result.candidates ? { candidates: result.candidates } : {});
        }
        parentTask = result.task;
    }

    var task;

    try {
        // Create child task
        var taskProps = { name: opts.taskName };
        if (opts.note) taskProps.note = opts.note;

        task = of.Task(taskProps);
        parentTask.tasks.push(task);

        // Apply all standard properties
        lib.applyTaskProps(of, doc, task, opts);
    } catch(e) {
        return lib.err("Failed to create subtask: " + e.message);
    }

    // Build result
    var parentProject = null;
    try { var pp = parentTask.containingProject(); if (pp) parentProject = pp.name(); } catch(e) {}

    return JSON.stringify({
        ok: true,
        id: task.id(),
        name: opts.taskName,
        task: lib.formatTaskFull(task),
        parent: {
            id: parentTask.id(),
            name: parentTask.name(),
            project: parentProject || "Inbox"
        }
    });
}
