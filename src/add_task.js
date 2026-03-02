#!/usr/bin/env osascript -l JavaScript

// Add a task to OmniFocus — full-featured with all metadata options
//
// Usage:
//   osascript -l JavaScript add_task.js "Task name" [options]
//
// Options:
//   --note "text"                        Task note / context
//   --due "YYYY-MM-DD"                   Due date (or YYYY-MM-DDTHH:MM for time)
//   --defer "YYYY-MM-DD"                 Defer/start date (task hidden until then)
//   --planned "YYYY-MM-DD"              Planned date (OmniFocus 4.7+ "Plan for Today")
//   --tag "Tag Name"                     Add tag (repeatable for multiple tags)
//   --flag                               Flag the task
//   --estimate N                         Estimated minutes (integer)
//   --project "Project Name"             Create in project (not inbox)
//   --sequential                         Set children to sequential
//   --repeat "RRULE"                     Repetition rule (e.g. "FREQ=DAILY;INTERVAL=1")
//   --repeat-method "due-date|completion" Repeat method (default: due-date)
//
// Returns: JSON { ok, id, name, task: { full task object } }
//
// Examples:
//   osascript -l JavaScript add_task.js "Buy groceries"
//   osascript -l JavaScript add_task.js "☑️🔴‼️🐸 Call tax attorney" --tag "🐸 Frog" --due "2026-02-05" --flag --estimate 15
//   osascript -l JavaScript add_task.js "Weekly review" --project "Routines" --repeat "FREQ=WEEKLY;BYDAY=SU" --repeat-method due-date
//   osascript -l JavaScript add_task.js "Sprint planning" --planned "2026-02-10" --estimate 30

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.skills/openclaw/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    if (args.length === 0) {
        return lib.err("Task name required", {
            usage: 'add_task.js "Task name" [--note text] [--due YYYY-MM-DD] [--defer YYYY-MM-DD] [--planned YYYY-MM-DD] [--tag name]... [--flag] [--estimate N] [--project name] [--sequential] [--repeat RRULE] [--repeat-method method]'
        });
    }

    var opts = lib.parseArgs(args, {
        taskName:     true,
        note:         'string',
        due:          'string',
        defer:        'string',
        planned:      'string',
        tag:          'array',
        flag:         'boolean',
        estimate:     'int',
        project:      'string',
        sequential:   'boolean',
        repeat:       'string',
        repeatMethod: 'string'
    });
    opts.tags = opts.tag;

    if (!opts.taskName) {
        return lib.err("Task name required as first argument");
    }

    var of = Application('OmniFocus');
    of.includeStandardAdditions = true;
    var doc = of.defaultDocument;

    var task;

    try {
        if (opts.project) {
            // Create task in project (strict lookup - never creates)
            var projectLookup = lib.findExistingProject(doc, opts.project);
            if (projectLookup.error) {
                return lib.err(projectLookup.error, projectLookup.candidates ? { candidates: projectLookup.candidates } : {});
            }
            var targetProject = projectLookup.project;
            var taskProps = { name: opts.taskName };
            if (opts.note) taskProps.note = opts.note;
            task = of.Task(taskProps);
            targetProject.tasks.push(task);
        } else {
            // Create inbox task
            var taskProps = { name: opts.taskName };
            if (opts.note) taskProps.note = opts.note;
            task = of.InboxTask(taskProps);
            doc.inboxTasks.push(task);
        }

        // Apply all standard properties (due, defer, planned, flag, estimate, sequential, repeat, tags)
        lib.applyTaskProps(of, doc, task, opts);
    } catch(e) {
        return lib.err("Failed to create task: " + e.message);
    }

    return JSON.stringify({
        ok: true,
        id: task.id(),
        name: opts.taskName,
        task: lib.formatTaskFull(task)
    });
}
