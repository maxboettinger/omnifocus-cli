#!/usr/bin/env osascript -l JavaScript

// List OmniFocus projects with filtering and formatting options
//
// Usage:
//   osascript -l JavaScript list_projects.js [options]
//
// Options:
//   --search "query"         Filter by name substring (case-insensitive)
//   --status "active|done|onhold|dropped"  Filter by status
//   --folder "name"          Filter by parent folder
//   --count                  Include task counts in output
//   --full                   Return full project objects (verbose)
//   --active-only            Only projects with incomplete tasks
//   --limit N                Limit results to first N projects
//
// Returns: JSON array of project names (default), or objects with --count/--full

ObjC.import("Foundation");

// Load library
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

    // Parse arguments
    var opts = lib.parseArgs(args, {
        search:     'string',
        status:     'string',
        folder:     'string',
        count:      'boolean',
        full:       'boolean',
        activeOnly: 'boolean',
        limit:      'int'
    });

    var projects = doc.flattenedProjects();
    var results = [];

    // Filter by folder - find target folder for scoped search
    if (opts.folder) {
        var folders = doc.flattenedFolders();
        var targetFolder = null;
        var lowerFolder = opts.folder.toLowerCase();
        for (var i = 0; i < folders.length; i++) {
            if (folders[i].name().toLowerCase().indexOf(lowerFolder) !== -1) {
                targetFolder = folders[i];
                break;
            }
        }
        if (targetFolder) {
            projects = targetFolder.flattenedProjects();
        } else {
            return lib.err("Folder not found: \"" + opts.folder + "\"");
        }
    }

    // Filter and format
    for (var j = 0; j < projects.length; j++) {
        var proj = projects[j];

        // Filter by search query
        if (opts.search) {
            var lower = opts.search.toLowerCase();
            if (proj.name().toLowerCase().indexOf(lower) === -1) {
                continue;
            }
        }

        // Filter by status
        if (opts.status) {
            try {
                var normalized = lib.normalizeProjectStatus(opts.status);
                var projStatus = proj.status();
                if (projStatus.toString() !== normalized) {
                    continue;
                }
            } catch(e) {
                return lib.err("Invalid status: " + opts.status + ". Must be active, done, onhold, or dropped.");
            }
        }

        // Filter by active-only (has incomplete tasks)
        if (opts.activeOnly) {
            var hasIncompleteTasks = false;
            try {
                var tasks = proj.flattenedTasks();
                for (var k = 0; k < tasks.length; k++) {
                    if (!tasks[k].completed()) {
                        hasIncompleteTasks = true;
                        break;
                    }
                }
            } catch(e) {}
            if (!hasIncompleteTasks) continue;
        }

        // Format output
        if (opts.full) {
            results.push(lib.formatProjectFull(proj));
        } else if (opts.count) {
            results.push(lib.formatProjectCompact(proj));
        } else {
            results.push(proj.name());
        }

        // Limit results
        if (opts.limit && results.length >= opts.limit) {
            break;
        }
    }

    return JSON.stringify(results, null, 2);
}
