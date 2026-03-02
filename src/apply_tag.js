#!/usr/bin/env osascript -l JavaScript

// Apply EXISTING tag(s) to an OmniFocus task — strict mode, never creates tags
//
// Usage:
//   osascript -l JavaScript apply_tag.js "task query" --tag "Tag Name" [--tag "Other"]
//   osascript -l JavaScript apply_tag.js --id "taskId" --tag "Tag Name"
//
// Errors if any tag doesn't exist (suggests similar tags).
// Returns: { ok, id, name, applied: [...], task: { full object } }

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    var opts = lib.parseArgs(args, {
        taskQuery: true,
        id: 'string',
        tag: 'array'
    });

    var query = opts.id || opts.taskQuery;
    if (!query) {
        return lib.err("Task name or --id required", {
            usage: 'osascript -l JavaScript apply_tag.js "task" --tag "Tag Name"'
        });
    }

    if (!opts.tag || opts.tag.length === 0) {
        return lib.err("At least one --tag required", {
            usage: 'osascript -l JavaScript apply_tag.js "task" --tag "Tag Name"'
        });
    }

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    // Find task
    var result = lib.findTaskByQuery(doc, query);
    if (result.error) {
        return lib.err(result.error, result.candidates ? { candidates: result.candidates } : {});
    }
    var task = result.task;

    // Validate ALL tags exist BEFORE applying any (atomic: all or nothing)
    var resolvedTags = [];
    for (var i = 0; i < opts.tag.length; i++) {
        var lookup = lib.findExistingTag(doc, opts.tag[i]);
        if (lookup.error) {
            var extra = { requestedTag: opts.tag[i] };
            if (lookup.candidates) extra.candidates = lookup.candidates;
            return lib.err(lookup.error, extra);
        }
        resolvedTags.push({ tag: lookup.tag, name: opts.tag[i] });
    }

    // Apply tags
    var applied = [];
    for (var j = 0; j < resolvedTags.length; j++) {
        try {
            of.add(resolvedTags[j].tag, { to: task.tags });
            applied.push(resolvedTags[j].tag.name());
        } catch(e) {
            return lib.err("Failed to apply tag \"" + resolvedTags[j].name + "\": " + e.message);
        }
    }

    return JSON.stringify({
        ok: true,
        id: task.id(),
        name: task.name(),
        applied: applied,
        task: lib.formatTaskFull(task)
    });
}
