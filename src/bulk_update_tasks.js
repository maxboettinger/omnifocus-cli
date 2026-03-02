#!/usr/bin/env osascript -l JavaScript
// bulk_update_tasks.js — Update multiple OmniFocus tasks from JSON array
//
// Usage:
//   echo '[{"id": "abc123", "note": "Updated"}, {"id": "xyz789", "due": "2026-03-01"}]' | osascript -l JavaScript bulk_update_tasks.js
//   osascript -l JavaScript bulk_update_tasks.js < updates.json
//
// Input: JSON array of update objects from stdin
// Each object requires:
//   - id (required) - OmniFocus task ID
// Each object supports all update_task.js options:
//   - name, note, noteAppend, due, defer, planned, flag, unflag, estimate, tags (array), removeTags (array),
//     project, sequential, parallel, repeat, repeatMethod, complete, incomplete
//
// Output: JSON array of results: [{ ok, id, changes?, task?, error? }, ...]
//
// Behavior: Continues processing on individual failures, returns all results
//
// Example input:
//   [
//     {"id": "taskId1", "note": "Updated note", "flag": true},
//     {"id": "taskId2", "due": "2026-03-01", "estimate": 30},
//     {"id": "taskId3", "complete": true}
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
        var stdin = $.NSFileHandle.fileHandleWithStandardInput;
        var inputData = ObjC.unwrap(stdin.readDataToEndOfFile);
        input = $.NSString.alloc.initWithDataEncoding(inputData, $.NSUTF8StringEncoding).js;

        if (!input || input.trim() === "") {
            return lib.err("No input provided. Expected JSON array on stdin.", { usage: "echo '[{...}]' | osascript -l JavaScript bulk_update_tasks.js" });
        }
    } catch(e) {
        return lib.err("Failed to read stdin: " + e.message);
    }

    // Parse JSON array
    var updates;
    try {
        updates = JSON.parse(input);
    } catch(e) {
        return lib.err("Invalid JSON: " + e.message, { input: input.substring(0, 100) });
    }

    if (!Array.isArray(updates)) {
        return lib.err("Input must be a JSON array", { got: typeof updates });
    }

    if (updates.length === 0) {
        return JSON.stringify([]);
    }

    // Limit batch size for performance and safety
    if (updates.length > 100) {
        return lib.err("Bulk update limited to 100 tasks per batch", {
            got: updates.length,
            hint: "Split large datasets into multiple batches for better performance"
        });
    }

    // Process each update
    var results = [];
    for (var i = 0; i < updates.length; i++) {
        var updateInput = updates[i];
        var result = updateSingleTask(of, doc, updateInput, lib);
        results.push(result);
    }

    return JSON.stringify(results);
}

/**
 * Update a single task from input object.
 * Returns: { ok, id, changes?, task?, error? }
 */
function updateSingleTask(of, doc, input, lib) {
    try {
        // Validate required fields
        if (!input.id || typeof input.id !== 'string') {
            return { ok: false, error: "Task ID is required", input: input };
        }

        // Find task by ID
        var task = lib.findTaskById(doc, input.id);
        if (!task) {
            return { ok: false, error: "Task not found", id: input.id };
        }

        var changes = [];

        // Handle completion/incompletion first (before other changes)
        if (input.complete) {
            try {
                task.markComplete();
            } catch(e) {
                task.completed = true;
            }
            changes.push("completed");
        }
        if (input.incomplete) {
            try {
                task.markIncomplete();
            } catch(e) {
                task.completed = false;
            }
            changes.push("uncompleted");
        }

        // Rename
        if (input.name) {
            task.name = input.name;
            changes.push("renamed → " + input.name);
        }

        // Note update
        if (input.note) {
            task.note = input.note;
            changes.push("note updated");
        }
        if (input.noteAppend) {
            var currentNote = task.note() || "";
            task.note = currentNote + (currentNote ? "\n" : "") + input.noteAppend;
            changes.push("note appended");
        }

        // Normalize input to parseArgs format for applyTaskProps
        var opts = {
            due: input.due || null,
            defer: input.defer || null,
            planned: input.planned || null,
            flag: input.flag || false,
            unflag: input.unflag || false,
            estimate: input.estimate !== undefined ? input.estimate : null,
            tags: input.tags || [],
            removeTags: input.removeTags || [],
            sequential: input.sequential || false,
            parallel: input.parallel || false,
            repeat: input.repeat || null,
            repeatMethod: input.repeatMethod || null
        };

        // Apply standard properties
        var propChanges = lib.applyTaskProps(of, doc, task, opts);
        changes = changes.concat(propChanges);

        // Project move
        if (input.project) {
            var projResult = lib.findExistingProject(doc, input.project);
            if (projResult.error) {
                changes.push("project move failed: " + projResult.error);
            } else {
                task.assignedContainer = projResult.project;
                changes.push("moved to " + input.project);
            }
        }

        return {
            ok: true,
            id: task.id(),
            changes: changes,
            task: lib.formatTaskFull(task)
        };
    } catch(e) {
        return { ok: false, error: "Update failed: " + e.message, id: input.id };
    }
}
