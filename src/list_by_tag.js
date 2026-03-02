#!/usr/bin/env osascript -l JavaScript

// List tasks by tag name with full output
//
// Usage:
//   osascript -l JavaScript list_by_tag.js "Tag Name" [limit]
//
// Returns: JSON array of matching tasks with full metadata

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    if (args.length < 1) {
        return JSON.stringify({ error: "Tag name required" });
    }

    var tagName = args[0];
    var limit = args.length > 1 ? parseInt(args[1]) : 50;

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    // Find the tag
    var tags = doc.flattenedTags.whose({ name: tagName })();

    if (tags.length === 0) {
        return JSON.stringify({ error: "Tag \"" + tagName + "\" not found", tasks: [] });
    }

    var tag = tags[0];
    var tasks = tag.tasks();
    var results = [];

    for (var i = 0; i < tasks.length && results.length < limit; i++) {
        var task = tasks[i];
        if (task.completed()) continue;
        results.push(lib.formatTaskFull(task));
    }

    return JSON.stringify(results, null, 2);
}
