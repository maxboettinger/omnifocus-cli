#!/usr/bin/env osascript -l JavaScript

// Show detailed information about an OmniFocus project
//
// Usage:
//   osascript -l JavaScript show_project.js "Project Name"
//   osascript -l JavaScript show_project.js --id "project-id"
//
// Returns: JSON object with full project details

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
        id: 'string'
    });

    if (!opts.projectName && !opts.id) {
        return lib.err("Project name or --id required", {
            usage: 'show_project.js "Project Name" OR show_project.js --id "project-id"'
        });
    }

    var project = null;

    // Find by ID
    if (opts.id) {
        try {
            project = doc.flattenedProjects.byId(opts.id);
            if (!project || !project.name()) project = null;
        } catch(e) {}

        if (!project) {
            return lib.err("Project not found with ID: \"" + opts.id + "\"");
        }
    } else {
        // Find by name using library function
        var lookup = lib.findExistingProject(doc, opts.projectName);
        if (lookup.error) {
            return lib.err(lookup.error, lookup.candidates ? { candidates: lookup.candidates } : {});
        }
        project = lookup.project;
    }

    // Format and return
    var formatted = lib.formatProjectFull(project);

    // Add computed stats
    var overdueTasks = 0;
    var now = new Date();
    try {
        var tasks = project.flattenedTasks();
        for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            if (!task.completed() && task.dueDate() && task.dueDate() < now) {
                overdueTasks++;
            }
        }
    } catch(e) {}

    formatted.overdueTaskCount = overdueTasks;
    formatted.completionPercentage = formatted.taskCount > 0
        ? Math.round((formatted.completedTaskCount / formatted.taskCount) * 100)
        : 0;

    return JSON.stringify({ ok: true, project: formatted }, null, 2);
}
