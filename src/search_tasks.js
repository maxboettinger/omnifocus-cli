#!/usr/bin/env osascript -l JavaScript

// Search tasks in OmniFocus by keyword with full output
//
// Usage:
//   osascript -l JavaScript search_tasks.js "search term" [limit]
//
// Searches task names (case-insensitive via native whose() predicate).
// Falls back to note search for additional matches.
// Returns incomplete tasks only.
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
    if (args.length === 0) {
        return JSON.stringify({ error: "Search term required" });
    }

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    var searchTerm = args[0];
    var limit = args.length > 1 ? parseInt(args[1]) : 50;

    // Use whose() for fast native predicate search (case-insensitive)
    var nameMatches = doc.flattenedTasks.whose({ name: { _contains: searchTerm } })();
    var seenIds = {};
    var results = [];

    for (var i = 0; i < nameMatches.length && results.length < limit; i++) {
        if (nameMatches[i].completed()) continue;
        var id = nameMatches[i].id();
        if (seenIds[id]) continue;
        seenIds[id] = true;
        results.push(lib.formatTaskFull(nameMatches[i]));
    }

    // Also search notes if we haven't hit the limit
    // (whose() doesn't support note search well, so use a targeted approach)
    if (results.length < limit) {
        var noteMatches = doc.flattenedTasks.whose({ note: { _contains: searchTerm } })();
        for (var j = 0; j < noteMatches.length && results.length < limit; j++) {
            if (noteMatches[j].completed()) continue;
            var nid = noteMatches[j].id();
            if (seenIds[nid]) continue;
            seenIds[nid] = true;
            results.push(lib.formatTaskFull(noteMatches[j]));
        }
    }

    return JSON.stringify(results, null, 2);
}
