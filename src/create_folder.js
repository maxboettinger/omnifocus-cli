#!/usr/bin/env osascript -l JavaScript

// Create a new OmniFocus folder
//
// Usage:
//   osascript -l JavaScript create_folder.js "Folder Name" [--parent "Parent Folder"]
//
// Returns: { ok, id, name, folder }

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
        folderName: true,
        parent:     'string'
    });

    if (!opts.folderName) {
        return lib.err("Folder name required", {
            usage: 'create_folder.js "Folder Name" [--parent "Parent Folder"]'
        });
    }

    // Check if folder already exists
    var folders = doc.flattenedFolders();
    for (var i = 0; i < folders.length; i++) {
        if (folders[i].name() === opts.folderName) {
            return lib.err("Folder already exists: \"" + opts.folderName + "\"", {
                existingId: folders[i].id()
            });
        }
    }

    // Find parent folder if specified
    var parentFolder = null;
    if (opts.parent) {
        var lowerParent = opts.parent.toLowerCase();
        for (var j = 0; j < folders.length; j++) {
            if (folders[j].name().toLowerCase().indexOf(lowerParent) !== -1) {
                parentFolder = folders[j];
                break;
            }
        }
        if (!parentFolder) {
            return lib.err("Parent folder not found: \"" + opts.parent + "\"");
        }
    }

    // Create folder
    try {
        var folder = of.Folder({ name: opts.folderName });

        if (parentFolder) {
            parentFolder.folders.push(folder);
        } else {
            doc.folders.push(folder);
        }

        return JSON.stringify({
            ok: true,
            id: folder.id(),
            name: folder.name(),
            folder: {
                id: folder.id(),
                name: folder.name(),
                parentFolder: parentFolder ? parentFolder.name() : null
            }
        }, null, 2);

    } catch(e) {
        return lib.err("Failed to create folder: " + e.message);
    }
}
