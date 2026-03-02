#!/usr/bin/env osascript -l JavaScript

// Update an OmniFocus project's properties
//
// Usage:
//   osascript -l JavaScript update_project.js "Project Name" [options]
//   osascript -l JavaScript update_project.js --id "project-id" [options]
//
// Options:
//   --name "new name"        Rename project
//   --note "text"            Replace note
//   --note-append "text"     Append to note
//   --status "active|done|onhold|dropped"  Change status
//   --folder "name"          Move to folder
//   --sequential             Set as sequential
//   --parallel               Set as parallel
//   --flag                   Flag project
//   --unflag                 Unflag project
//
// Returns: { ok, id, name, changes: [...], project }

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
        name:        'string',
        note:        'string',
        noteAppend:  'string',
        status:      'string',
        folder:      'string',
        sequential:  'boolean',
        parallel:    'boolean',
        flag:        'boolean',
        unflag:      'boolean'
    });

    if (!opts.projectName && !opts.id) {
        return lib.err("Project name or --id required", {
            usage: 'update_project.js "Project Name" [--name "new"] [--status "active"] [--folder "name"] ...'
        });
    }

    // Find project
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

    var changes = [];

    // Rename
    if (opts.name) {
        // Check new name doesn't conflict
        var existing = lib.findExistingProject(doc, opts.name);
        if (existing.project && existing.project.id() !== project.id()) {
            return lib.err("Project name \"" + opts.name + "\" already exists", {
                existingId: existing.project.id()
            });
        }
        var oldName = project.name();
        project.name = opts.name;
        changes.push("renamed: \"" + oldName + "\" → \"" + opts.name + "\"");
    }

    // Note
    if (opts.note) {
        project.note = opts.note;
        changes.push("note updated");
    }
    if (opts.noteAppend) {
        var currentNote = project.note() || "";
        project.note = currentNote + (currentNote ? "\n\n" : "") + opts.noteAppend;
        changes.push("note appended");
    }

    // Status
    if (opts.status) {
        try {
            var oldStatus = project.status().toString();
            var normalized = lib.normalizeProjectStatus(opts.status);
            project.status = normalized;
            changes.push("status: " + oldStatus + " → " + normalized);
        } catch(e) {
            return lib.err("Status update failed: " + e.message);
        }
    }

    // Sequential/Parallel
    if (opts.sequential) {
        project.sequential = true;
        changes.push("set sequential");
    }
    if (opts.parallel) {
        project.sequential = false;
        changes.push("set parallel");
    }

    // Flag
    if (opts.flag) {
        project.flagged = true;
        changes.push("flagged");
    }
    if (opts.unflag) {
        project.flagged = false;
        changes.push("unflagged");
    }

    // Move to folder
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
        if (!targetFolder) {
            return lib.err("Folder not found: \"" + opts.folder + "\"");
        }

        try {
            // Move project to folder
            of.move(project, { to: targetFolder.projects.end });
            changes.push("moved to folder: " + targetFolder.name());
        } catch(e) {
            return lib.err("Failed to move to folder: " + e.message);
        }
    }

    if (changes.length === 0) {
        return lib.err("No changes specified. Use --name, --status, --note, etc.");
    }

    return JSON.stringify({
        ok: true,
        id: project.id(),
        name: project.name(),
        changes: changes,
        project: lib.formatProjectFull(project)
    }, null, 2);
}
