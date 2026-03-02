#!/usr/bin/env osascript -l JavaScript

// Test suite for findExistingProject() function

ObjC.import("Foundation");

// Load test helpers
var helpers = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.skills/openclaw/omnifocus/tests/_test_helpers.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _test_helpers.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

// Load omnifocus library
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
            name: "findExistingProject - exact match returns project",
            fn: function(of, doc, h) {
                var proj = h.createTestProject(of, doc, "ExactMatch");
                var result = lib.findExistingProject(doc, proj.name());
                h.assertTrue(result.project, "Should return project object");
                h.assertEqual(result.project.name(), proj.name(), "Names should match");
            }
        },
        {
            name: "findExistingProject - substring match returns project",
            fn: function(of, doc, h) {
                var proj = h.createTestProject(of, doc, "MyUniqueProject");
                var result = lib.findExistingProject(doc, "Unique");
                h.assertTrue(result.project, "Should return project via substring");
                h.assertEqual(result.project.name(), proj.name(), "Should match created project");
            }
        },
        {
            name: "findExistingProject - not found returns error",
            fn: function(of, doc, h) {
                var result = lib.findExistingProject(doc, "NonExistentProject12345");
                h.assertFalse(result.project, "Should not return project");
                h.assertTrue(result.error, "Should return error");
                h.assertTrue(result.error.indexOf("not found") !== -1, "Error should mention 'not found'");
            }
        },
        {
            name: "findExistingProject - ambiguous match returns error with candidates",
            fn: function(of, doc, h) {
                var proj1 = h.createTestProject(of, doc, "Ambig_One");
                var proj2 = h.createTestProject(of, doc, "Ambig_Two");
                var result = lib.findExistingProject(doc, "Ambig");
                h.assertFalse(result.project, "Should not return project");
                h.assertTrue(result.error, "Should return error");
                h.assertTrue(result.error.indexOf("Ambiguous") !== -1, "Error should mention 'Ambiguous'");
                h.assertTrue(result.candidates, "Should return candidates");
                h.assertTrue(result.candidates.length >= 2, "Should have at least 2 candidates");
            }
        },
        {
            name: "findExistingProject - case insensitive search",
            fn: function(of, doc, h) {
                var proj = h.createTestProject(of, doc, "CaseSensitive");
                var result = lib.findExistingProject(doc, "casesensitive");
                h.assertTrue(result.project, "Should match case-insensitively");
                h.assertEqual(result.project.name(), proj.name(), "Should return correct project");
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
