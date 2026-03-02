#!/usr/bin/env osascript -l JavaScript

// Delete an OmniFocus project (requires --confirm flag for safety)
//
// Usage:
//   osascript -l JavaScript delete_project.js "Project Name" --confirm
//   osascript -l JavaScript delete_project.js --id "project-id" --confirm
//
// Without --confirm: returns error with task count as a dry-run safety check
// With --confirm: deletes the project
//
// Returns: { ok, deleted: { id, name, tasksAffected } }

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
        confirm:     'boolean'
    });

    if (!opts.projectName && !opts.id) {
        return lib.err("Project name or --id required", {
            usage: 'delete_project.js "Project Name" --confirm OR delete_project.js --id "id" --confirm'
        });
    }

    var project = null;

    // Find project
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

    // Count tasks
    var incompleteTasks = 0;
    var totalTasks = 0;
    try {
        var tasks = project.flattenedTasks();
        totalTasks = tasks.length;
        for (var i = 0; i < tasks.length; i++) {
            if (!tasks[i].completed()) {
                incompleteTasks++;
            }
        }
    } catch(e) {}

    // Safety check - require --confirm
    if (!opts.confirm) {
        return lib.err(
            "Delete requires --confirm flag. Project \"" + project.name() + "\" has " +
            incompleteTasks + " incomplete task(s) (" + totalTasks + " total).",
            {
                tasksAffected: totalTasks,
                incompleteTasks: incompleteTasks,
                project: project.name(),
                projectId: project.id()
            }
        );
    }

    // Delete the project
    var deletedName = project.name();
    var deletedId = project.id();

    try {
        of.delete(project);
        return JSON.stringify({
            ok: true,
            deleted: {
                id: deletedId,
                name: deletedName,
                tasksAffected: totalTasks
            }
        }, null, 2);
    } catch(e) {
        return lib.err("Failed to delete project: " + e.message);
    }
}
