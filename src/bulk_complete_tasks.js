#!/usr/bin/env osascript -l JavaScript
// bulk_complete_tasks.js — Complete or uncomplete multiple OmniFocus tasks
//
// Usage:
//   echo '["taskId1", "taskId2", "taskId3"]' | osascript -l JavaScript bulk_complete_tasks.js
//   echo '["taskId1", "taskId2"]' | osascript -l JavaScript bulk_complete_tasks.js --incomplete
//   osascript -l JavaScript bulk_complete_tasks.js < task_ids.json
//
// Input: JSON array of task IDs from stdin
//
// Options:
//   --incomplete     Mark tasks as incomplete instead of complete
//
// Output: JSON array of results: [{ ok, id, action, task?, error? }, ...]
//
// Behavior: Continues processing on individual failures, returns all results
//
// Example input:
//   ["abc123", "xyz789", "def456"]

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

    // Parse args for --incomplete flag
    var markIncomplete = false;
    for (var i = 0; i < args.length; i++) {
        if (args[i] === '--incomplete') {
            markIncomplete = true;
            break;
        }
    }

    // Read JSON array from stdin
    var input;
    try {
        var stdin = $.NSFileHandle.fileHandleWithStandardInput;
        var inputData = ObjC.unwrap(stdin.readDataToEndOfFile);
        input = $.NSString.alloc.initWithDataEncoding(inputData, $.NSUTF8StringEncoding).js;

        if (!input || input.trim() === "") {
            return lib.err("No input provided. Expected JSON array of task IDs on stdin.", { usage: "echo '[\"id1\", \"id2\"]' | osascript -l JavaScript bulk_complete_tasks.js" });
        }
    } catch(e) {
        return lib.err("Failed to read stdin: " + e.message);
    }

    // Parse JSON array
    var taskIds;
    try {
        taskIds = JSON.parse(input);
    } catch(e) {
        return lib.err("Invalid JSON: " + e.message, { input: input.substring(0, 100) });
    }

    if (!Array.isArray(taskIds)) {
        return lib.err("Input must be a JSON array of task IDs", { got: typeof taskIds });
    }

    if (taskIds.length === 0) {
        return JSON.stringify([]);
    }

    // Limit batch size for performance and safety
    if (taskIds.length > 100) {
        return lib.err("Bulk complete limited to 100 tasks per batch", {
            got: taskIds.length,
            hint: "Split large datasets into multiple batches for better performance"
        });
    }

    // Process each task ID
    var results = [];
    for (var i = 0; i < taskIds.length; i++) {
        var taskId = taskIds[i];
        var result = completeSingleTask(of, doc, taskId, markIncomplete, lib);
        results.push(result);
    }

    return JSON.stringify(results);
}

/**
 * Complete or uncomplete a single task by ID.
 * Returns: { ok, id, action, task?, error? }
 */
function completeSingleTask(of, doc, taskId, markIncomplete, lib) {
    try {
        // Validate task ID
        if (!taskId || typeof taskId !== 'string') {
            return { ok: false, error: "Invalid task ID", id: taskId };
        }

        // Find task by ID
        var task = lib.findTaskById(doc, taskId);
        if (!task) {
            return { ok: false, error: "Task not found", id: taskId };
        }

        // Complete or uncomplete
        var action;
        try {
            if (markIncomplete) {
                try {
                    task.markIncomplete();
                } catch(e) {
                    task.completed = false;
                }
                action = "uncompleted";
            } else {
                try {
                    task.markComplete();
                } catch(e) {
                    task.completed = true;
                }
                action = "completed";
            }

            return {
                ok: true,
                id: task.id(),
                action: action,
                task: lib.formatTaskFull(task)
            };
        } catch(e) {
            return { ok: false, error: "Completion failed: " + e.message, id: taskId };
        }
    } catch(e) {
        return { ok: false, error: "Unexpected error: " + e.message, id: taskId };
    }
}
