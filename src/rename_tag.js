#!/usr/bin/env osascript -l JavaScript

// Rename an OmniFocus tag
//
// Usage:
//   osascript -l JavaScript rename_tag.js "Old Name" --name "New Name"
//
// Fails if old tag doesn't exist or new name already taken.
// Returns: { ok, oldName, newName }

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
        name: 'string'
    });

    if (!opts.tagName) {
        return lib.err("Current tag name required", {
            usage: 'osascript -l JavaScript rename_tag.js "Old Name" --name "New Name"'
        });
    }

    if (!opts.name) {
        return lib.err("New name required (--name)", {
            usage: 'osascript -l JavaScript rename_tag.js "Old Name" --name "New Name"'
        });
    }

    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    // Find the tag to rename
    var tag = lib.findTag(doc, opts.tagName);
    if (!tag) {
        return lib.err("Tag not found: \"" + opts.tagName + "\"");
    }

    // Check new name isn't already taken
    var conflict = lib.findTag(doc, opts.name);
    if (conflict) {
        return lib.err("Tag already exists with name: \"" + opts.name + "\"");
    }

    // Rename
    try {
        tag.name = opts.name;
        return JSON.stringify({
            ok: true,
            oldName: opts.tagName,
            newName: opts.name
        });
    } catch(e) {
        return lib.err("Failed to rename tag: " + e.message);
    }
}
