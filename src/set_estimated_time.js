#!/usr/bin/env osascript -l JavaScript

// Set estimated time for a task
// Usage: osascript -l JavaScript set_estimated_time.js "task name or id" minutes
// Example: osascript -l JavaScript set_estimated_time.js "Review document" 30

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    if (args.length < 2) {
        return lib.err("Usage: set_estimated_time.js 'task name or id' minutes");
    }

    var query = args[0];
    var minutes = parseInt(args[1]);

    if (isNaN(minutes) || minutes < 0) {
        return lib.err("Minutes must be a positive number");
    }

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    var result = lib.findTaskByQuery(doc, query);

    if (result.error) {
        return lib.err(result.error, { candidates: result.candidates || [] });
    }

    var task = result.task;
    var oldEstimate = task.estimatedMinutes() || null;

    // Set the estimate (0 clears it)
    if (minutes === 0) {
        task.estimatedMinutes = null;
    } else {
        task.estimatedMinutes = minutes;
    }

    return JSON.stringify({
        ok: true,
        name: task.name(),
        id: task.id(),
        oldEstimatedMinutes: oldEstimate,
        newEstimatedMinutes: minutes === 0 ? null : minutes,
        task: lib.formatTaskFull(task)
    });
}
