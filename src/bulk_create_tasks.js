#!/usr/bin/env osascript -l JavaScript
// bulk_create_tasks.js — Create multiple OmniFocus tasks from JSON array
//
// Usage:
//   echo '[{"name": "Task 1"}, {"name": "Task 2", "due": "2026-03-01"}]' | osascript -l JavaScript bulk_create_tasks.js
//   osascript -l JavaScript bulk_create_tasks.js < tasks.json
//
// Input: JSON array of task objects from stdin
// Each object supports all add_task.js options:
//   - name (required)
//   - note, due, defer, planned, flag, estimate, project, sequential, repeat, repeatMethod, tags (array)
//
// Output: JSON array of results: [{ ok, id?, name?, task?, error? }, ...]
//
// Behavior: Continues processing on individual failures, returns all results
//
// Example input:
//   [
//     {"name": "Buy groceries", "due": "2026-02-15"},
//     {"name": "Call dentist", "flag": true, "estimate": 10},
//     {"name": "Review PR", "project": "Work", "tags": ["🟠 P2"]}
//   ]

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

    // Read JSON array from stdin
    var input;
    try {
        // Read from stdin using NSFileHandle
        var stdin = $.NSFileHandle.fileHandleWithStandardInput;
        var inputData = ObjC.unwrap(stdin.readDataToEndOfFile);
        input = $.NSString.alloc.initWithDataEncoding(inputData, $.NSUTF8StringEncoding).js;

        if (!input || input.trim() === "") {
            return lib.err("No input provided. Expected JSON array on stdin.", { usage: "echo '[{...}]' | osascript -l JavaScript bulk_create_tasks.js" });
        }
    } catch(e) {
        return lib.err("Failed to read stdin: " + e.message);
    }

    // Parse JSON array
    var tasks;
    try {
        tasks = JSON.parse(input);
    } catch(e) {
        return lib.err("Invalid JSON: " + e.message, { input: input.substring(0, 100) });
    }

    if (!Array.isArray(tasks)) {
        return lib.err("Input must be a JSON array", { got: typeof tasks });
    }

    if (tasks.length === 0) {
        return JSON.stringify([]);
    }

    // Limit batch size for performance and safety
    if (tasks.length > 100) {
        return lib.err("Bulk create limited to 100 tasks per batch", {
            got: tasks.length,
            hint: "Split large datasets into multiple batches for better performance"
        });
    }

    // Process each task
    var results = [];
    for (var i = 0; i < tasks.length; i++) {
        var taskInput = tasks[i];
        var result = createSingleTask(of, doc, taskInput, lib);
        results.push(result);
    }

    return JSON.stringify(results);
}

/**
 * Create a single task from input object.
 * Returns: { ok, id?, name?, task?, error? }
 */
function createSingleTask(of, doc, input, lib) {
    try {
        // Validate required fields
        if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
            return { ok: false, error: "Task name is required and cannot be blank", input: input };
        }

        // Normalize input to parseArgs format
        var opts = {
            taskName: input.name,
            note: input.note || null,
            due: input.due || null,
            defer: input.defer || null,
            planned: input.planned || null,
            flag: input.flag || false,
            estimate: input.estimate || null,
            project: input.project || null,
            sequential: input.sequential || false,
            repeat: input.repeat || null,
            repeatMethod: input.repeatMethod || null,
            tags: input.tags || []
        };

        // Find project if specified
        var targetProject = null;
        if (opts.project) {
            var projResult = lib.findExistingProject(doc, opts.project);
            if (projResult.error) {
                return { ok: false, error: "Project lookup failed: " + projResult.error, name: opts.taskName };
            }
            targetProject = projResult.project;
        }

        // Create task
        var task;
        try {
            if (targetProject) {
                var taskProps = { name: opts.taskName };
                if (opts.note) taskProps.note = opts.note;
                task = of.Task(taskProps);
                targetProject.tasks.push(task);
            } else {
                var taskProps = { name: opts.taskName };
                if (opts.note) taskProps.note = opts.note;
                task = of.InboxTask(taskProps);
                doc.inboxTasks.push(task);
            }

            // Apply properties (due, defer, planned, flag, estimate, sequential, repeat, tags)
            lib.applyTaskProps(of, doc, task, opts);

            return {
                ok: true,
                id: task.id(),
                name: task.name(),
                task: lib.formatTaskFull(task)
            };
        } catch(e) {
            return { ok: false, error: "Task creation failed: " + e.message, name: opts.taskName };
        }
    } catch(e) {
        return { ok: false, error: "Unexpected error: " + e.message, input: input };
    }
}
