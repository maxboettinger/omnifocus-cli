#!/usr/bin/env osascript -l JavaScript

// Rename an OmniFocus project
//
// Usage:
//   osascript -l JavaScript rename_project.js "Old Name" --name "New Name"
//   osascript -l JavaScript rename_project.js --id "project-id" --name "New Name"
//
// Returns: { ok, id, oldName, newName, project }

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
        projectName: true,
        id:          'string',
        name:        'string'
    });

    if (!opts.projectName && !opts.id) {
        return lib.err("Project name or --id required");
    }

    if (!opts.name) {
        return lib.err("New name required (--name \"New Name\")", {
            usage: 'rename_project.js "Old Name" --name "New Name"'
        });
    }

    // Find old project
    var project = null;
    if (opts.id) {
        try {
            project = doc.flattenedProjects.byId(opts.id);
            if (!project || !project.name()) project = null;
        } catch(e) {}

        if (!project) {
            return lib.err("Project not found with ID: \"" + opts.id + "\"");
        }
    } else {
        var lookup = lib.findExistingProject(doc, opts.projectName);
        if (lookup.error) {
            return lib.err(lookup.error, lookup.candidates ? { candidates: lookup.candidates } : {});
        }
        project = lookup.project;
    }

    var oldName = project.name();

    // Check new name doesn't conflict
    var existing = lib.findExistingProject(doc, opts.name);
    if (existing.error && existing.error.indexOf("Ambiguous") !== -1) {
        // Ambiguous match - can't rename to this
        return lib.err(existing.error, existing.candidates ? { candidates: existing.candidates } : {});
    }
    if (existing.project && existing.project.id() !== project.id()) {
        return lib.err("Project name \"" + opts.name + "\" already exists", {
            existingId: existing.project.id(),
            existingName: existing.project.name()
        });
    }

    // Rename
    try {
        project.name = opts.name;

        return JSON.stringify({
            ok: true,
            id: project.id(),
            oldName: oldName,
            newName: opts.name,
            project: lib.formatProjectFull(project)
        }, null, 2);

    } catch(e) {
        return lib.err("Failed to rename project: " + e.message);
    }
}
