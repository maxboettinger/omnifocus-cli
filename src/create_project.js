#!/usr/bin/env osascript -l JavaScript

// Create a new OmniFocus project
//
// Usage:
//   osascript -l JavaScript create_project.js "Project Name" [options]
//
// Options:
//   --folder "name"          Create in specific folder
//   --status "active|onhold|done|dropped"  Set initial status
//   --sequential             Set as sequential project
//   --note "text"            Add note to project
//   --flag                   Flag the project
//
// Returns: { ok, id, name, project }

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
        folder:      'string',
        status:      'string',
        sequential:  'boolean',
        note:        'string',
        flag:        'boolean'
    });

    if (!opts.projectName) {
        return lib.err("Project name required", {
            usage: 'create_project.js "Project Name" [--folder "name"] [--status "active"] [--sequential] [--note "text"]'
        });
    }

    // Check if project already exists
    var existing = lib.findExistingProject(doc, opts.projectName);
    if (existing.project) {
        return lib.err("Project already exists: \"" + existing.project.name() + "\"", {
            existingId: existing.project.id(),
            existingName: existing.project.name()
        });
    }

    // Find folder if specified
    var targetFolder = null;
    if (opts.folder) {
        var folders = doc.flattenedFolders();
        var lowerFolder = opts.folder.toLowerCase();
        for (var i = 0; i < folders.length; i++) {
            if (folders[i].name().toLowerCase().indexOf(lowerFolder) !== -1) {
                targetFolder = folders[i];
                break;
            }
        }
        if (!targetFolder) {
            return lib.err("Folder not found: \"" + opts.folder + "\"");
        }
    }

    // Create project
    try {
        var project = of.Project({ name: opts.projectName });

        // CRITICAL: Use .push() not .add() for JXA
        if (targetFolder) {
            targetFolder.projects.push(project);
        } else {
            doc.projects.push(project);
        }

        // Set initial properties
        if (opts.note) {
            project.note = opts.note;
        }

        if (opts.sequential) {
            project.sequential = true;
        }

        if (opts.flag) {
            project.flagged = true;
        }

        if (opts.status) {
            try {
                var normalized = lib.normalizeProjectStatus(opts.status);
                project.status = normalized;
            } catch(e) {
                // Project created but status setting failed - warn but don't error
                return JSON.stringify({
                    ok: true,
                    id: project.id(),
                    name: project.name(),
                    warning: "Project created but status failed: " + e.message,
                    project: lib.formatProjectFull(project)
                }, null, 2);
            }
        }

        return JSON.stringify({
            ok: true,
            id: project.id(),
            name: project.name(),
            project: lib.formatProjectFull(project)
        }, null, 2);

    } catch(e) {
        return lib.err("Failed to create project: " + e.message);
    }
}
