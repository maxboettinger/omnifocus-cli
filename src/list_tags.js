#!/usr/bin/env osascript -l JavaScript

// List/search OmniFocus tags with compact output for context-window efficiency
//
// Usage:
//   osascript -l JavaScript list_tags.js [options]
//
// Options:
//   --search "partial"   Filter by substring (case-insensitive)
//   --count              Include task counts in output
//   --active-only        Only tags with incomplete tasks
//   --limit N            Max results (default: 100)
//
// Default output: JSON array of tag name strings ["tag1", "tag2", ...]
// With --count:   JSON array of objects [{ "name": "tag1", "taskCount": 5 }, ...]

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    var opts = lib.parseArgs(args, {
        search: 'string',
        count: 'boolean',
        activeOnly: 'boolean',
        limit: 'int'
    });

    var limit = opts.limit || 100;

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    // Batch access for performance: get all tag names in one Apple Event
    var allTags = doc.flattenedTags();
    var results = [];

    for (var i = 0; i < allTags.length && results.length < limit; i++) {
        var tag = allTags[i];
        var tagName = tag.name();

        // Search filter (case-insensitive substring)
        if (opts.search) {
            if (tagName.toLowerCase().indexOf(opts.search.toLowerCase()) === -1) {
                continue;
            }
        }

        // Active-only filter: count incomplete tasks
        var taskCount = 0;
        if (opts.activeOnly || opts.count) {
            try {
                var tasks = tag.tasks();
                for (var j = 0; j < tasks.length; j++) {
                    if (!tasks[j].completed()) taskCount++;
                }
            } catch(e) {
                taskCount = 0;
            }
            if (opts.activeOnly && taskCount === 0) continue;
        }

        if (opts.count) {
            results.push({ name: tagName, taskCount: taskCount });
        } else {
            results.push(tagName);
        }
    }

    return JSON.stringify(results);
}
