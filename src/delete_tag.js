#!/usr/bin/env osascript -l JavaScript

// Delete an OmniFocus tag (requires --confirm flag for safety)
//
// Usage:
//   osascript -l JavaScript delete_tag.js "Tag Name" --confirm
//
// Without --confirm: returns error with task count as a dry-run safety check
// With --confirm: deletes the tag
// Returns: { ok, name, tasksAffected }

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
        tagName: true,
        confirm: 'boolean'
    });

    if (!opts.tagName) {
        return lib.err("Tag name required", {
            usage: 'osascript -l JavaScript delete_tag.js "Tag Name" --confirm'
        });
    }

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    // Find the tag
    var tag = lib.findTag(doc, opts.tagName);
    if (!tag) {
        return lib.err("Tag not found: \"" + opts.tagName + "\"");
    }

    // Count affected tasks
    var tasksAffected = 0;
    try {
        var tasks = tag.tasks();
        for (var i = 0; i < tasks.length; i++) {
            if (!tasks[i].completed()) tasksAffected++;
        }
    } catch(e) {}

    // Safety check: require --confirm
    if (!opts.confirm) {
        return lib.err(
            "Delete requires --confirm flag. Tag \"" + opts.tagName + "\" has " +
            tasksAffected + " incomplete task(s).",
            { tasksAffected: tasksAffected, tag: opts.tagName }
        );
    }

    // Delete the tag
    try {
        of.delete(tag);
        return JSON.stringify({
            ok: true,
            name: opts.tagName,
            tasksAffected: tasksAffected
        });
    } catch(e) {
        return lib.err("Failed to delete tag: " + e.message);
    }
}
