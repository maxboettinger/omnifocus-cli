#!/usr/bin/env osascript -l JavaScript

// Create a new OmniFocus tag (fails if tag already exists)
//
// Usage:
//   osascript -l JavaScript create_tag.js "Tag Name"
//
// Returns: { ok, name }

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
        tagName: true
    });

    if (!opts.tagName) {
        return lib.err("Tag name required", {
            usage: 'osascript -l JavaScript create_tag.js "Tag Name"'
        });
    }

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    // Check if tag already exists
    var existing = lib.findTag(doc, opts.tagName);
    if (existing) {
        return lib.err("Tag already exists: \"" + opts.tagName + "\"");
    }

    // Create the tag
    try {
        var tag = of.Tag({ name: opts.tagName });
        doc.tags.push(tag);
        // Re-fetch for stable reference
        var fetched = doc.flattenedTags.whose({ name: opts.tagName })[0];
        var finalName = fetched ? fetched.name() : opts.tagName;

        return JSON.stringify({ ok: true, name: finalName });
    } catch(e) {
        return lib.err("Failed to create tag: " + e.message);
    }
}
