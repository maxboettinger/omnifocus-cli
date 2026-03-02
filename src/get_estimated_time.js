#!/usr/bin/env osascript -l JavaScript

// Get estimated time for tasks
// Usage: osascript -l JavaScript get_estimated_time.js [task_name_or_id]
// Without args: lists all tasks with estimates
// With arg: gets estimate for specific task

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

    if (args.length > 0) {
        // Find specific task
        var query = args[0];
        var result = lib.findTaskByQuery(doc, query);

        if (result.error) {
            return JSON.stringify({ error: result.error, candidates: result.candidates || [] });
        }

        var task = result.task;
        return JSON.stringify({
            name: task.name(),
            id: task.id(),
            estimatedMinutes: task.estimatedMinutes() || null
        });
    }

    // List all tasks with estimates
    var allTasks = doc.flattenedTasks();
    var results = [];

    for (var i = 0; i < allTasks.length; i++) {
        var task = allTasks[i];
        if (task.completed()) continue;

        var estimate = task.estimatedMinutes();
        if (estimate && estimate > 0) {
            var project = null;
            try { var p = task.containingProject(); if (p) project = p.name(); } catch(e) {}
            results.push({
                name: task.name(),
                id: task.id(),
                estimatedMinutes: estimate,
                project: project || "Inbox"
            });
        }
    }

    return JSON.stringify(results, null, 2);
}
