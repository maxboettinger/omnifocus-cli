#!/usr/bin/env osascript -l JavaScript

// List OmniFocus folders
//
// Usage:
//   osascript -l JavaScript list_folders.js [options]
//
// Options:
//   --search "query"         Filter by name substring
//   --status "active|dropped"  Filter by status
//   --count                  Include project counts
//   --limit N                Limit results
//
// Returns: JSON array of folder names (default) or objects with --count

ObjC.import("Foundation");

var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.skills/openclaw/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    var opts = lib.parseArgs(args, {
        search:  'string',
        status:  'string',
        count:   'boolean',
        limit:   'int'
    });

    var folders = doc.flattenedFolders();
    var results = [];

    for (var i = 0; i < folders.length; i++) {
        var folder = folders[i];

        // Filter by search
        if (opts.search) {
            var lower = opts.search.toLowerCase();
            if (folder.name().toLowerCase().indexOf(lower) === -1) {
                continue;
            }
        }

        // Filter by status
        if (opts.status) {
            var folderStatus = folder.status().toString().replace(" status", "").toLowerCase();
            if (folderStatus !== opts.status.toLowerCase()) {
                continue;
            }
        }

        // Format output
        if (opts.count) {
            var projectCount = 0;
            try { projectCount = folder.flattenedProjects().length; } catch(e) {}

            results.push({
                name: folder.name(),
                projectCount: projectCount,
                status: folder.status().toString().replace(" status", "").toLowerCase()
            });
        } else {
            results.push(folder.name());
        }

        // Limit
        if (opts.limit && results.length >= opts.limit) {
            break;
        }
    }

    return JSON.stringify(results, null, 2);
}
