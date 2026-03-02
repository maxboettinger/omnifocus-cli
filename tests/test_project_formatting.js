#!/usr/bin/env osascript -l JavaScript

// Test suite for formatProjectFull() and formatProjectCompact()

ObjC.import("Foundation");

var helpers = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.skills/openclaw/omnifocus/tests/_test_helpers.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _test_helpers.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.skills/openclaw/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    var tests = [
        {
            name: "formatProjectFull - includes all required fields",
            fn: function(of, doc, h) {
                var proj = h.createTestProject(of, doc, "FullFormat");
                var formatted = lib.formatProjectFull(proj);

                h.assertTrue(formatted.id, "Should have id");
                h.assertTrue(formatted.name, "Should have name");
                h.assertTrue('note' in formatted, "Should have note field");
                h.assertTrue('status' in formatted, "Should have status");
                h.assertTrue('flagged' in formatted, "Should have flagged");
                h.assertTrue('sequential' in formatted, "Should have sequential");
                h.assertTrue('completed' in formatted, "Should have completed");
                h.assertTrue('taskCount' in formatted, "Should have taskCount");
                h.assertTrue('parentFolder' in formatted, "Should have parentFolder");
                h.assertTrue('tags' in formatted, "Should have tags");
            }
        },
        {
            name: "formatProjectCompact - returns minimal format",
            fn: function(of, doc, h) {
                var proj = h.createTestProject(of, doc, "CompactFormat");
                var formatted = lib.formatProjectCompact(proj);

                h.assertTrue(formatted.id, "Should have id");
                h.assertTrue(formatted.name, "Should have name");
                h.assertTrue('status' in formatted, "Should have status");
                h.assertTrue('taskCount' in formatted, "Should have taskCount");

                // Should NOT have other fields (compact)
                h.assertFalse('note' in formatted, "Should not have note");
                h.assertFalse('flagged' in formatted, "Should not have flagged");
            }
        },
        {
            name: "formatProjectFull - handles project with tasks",
            fn: function(of, doc, h) {
                var proj = h.createTestProject(of, doc, "WithTasks");
                // Add a task to the project
                var task = of.Task({ name: "Test Task" });
                proj.rootTask.tasks.push(task);

                var formatted = lib.formatProjectFull(proj);
                h.assertTrue(formatted.taskCount >= 1, "Should count tasks");
            }
        }
    ];

    var summary = helpers.runTests(tests);

    console.log("\n=== Test Results ===");
    console.log("Total: " + summary.total);
    console.log("Passed: " + summary.passed);
    console.log("Failed: " + summary.failed);
    console.log("\nDetails:");

    for (var i = 0; i < summary.results.length; i++) {
        var r = summary.results[i];
        var status = r.ok ? "✓ PASS" : "✗ FAIL";
        console.log(status + " - " + r.name);
        if (!r.ok) {
            console.log("  Error: " + r.error);
        }
    }

    return JSON.stringify(summary, null, 2);
}
