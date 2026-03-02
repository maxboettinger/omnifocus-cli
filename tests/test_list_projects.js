#!/usr/bin/env osascript -l JavaScript

// Integration test for list_projects.js script

ObjC.import("Foundation");

var helpers = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.skills/openclaw/omnifocus/tests/_test_helpers.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _test_helpers.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function runScript(scriptPath, args) {
    var task = $.NSTask.alloc.init;
    task.setLaunchPath("/usr/bin/osascript");
    var scriptArgs = $.NSMutableArray.alloc.init;
    scriptArgs.addObject($("-l"));
    scriptArgs.addObject($("JavaScript"));
    scriptArgs.addObject($(scriptPath));
    for (var i = 0; i < args.length; i++) {
        scriptArgs.addObject($(args[i]));
    }
    task.setArguments(scriptArgs);

    var pipe = $.NSPipe.pipe;
    task.setStandardOutput(pipe);
    task.setStandardError(pipe);

    task.launch;
    task.waitUntilExit;

    var data = pipe.fileHandleForReading.readDataToEndOfFile;
    var output = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;

    return {
        exitCode: task.terminationStatus,
        output: output
    };
}

function run(args) {
    var scriptPath = "/Users/max/.skills/openclaw/omnifocus/scripts/list_projects.js";

    var tests = [
        {
            name: "list_projects - basic list returns array",
            fn: function(of, doc, h) {
                // Create some test projects
                h.createTestProject(of, doc, "ListTest1");
                h.createTestProject(of, doc, "ListTest2");

                var result = runScript(scriptPath, []);
                h.assertEqual(result.exitCode, 0, "Script should exit successfully");

                var output = JSON.parse(result.output);
                h.assertTrue(Array.isArray(output), "Should return array");
                h.assertTrue(output.length > 0, "Should have projects");

                // Check that test projects are in the list
                var hasTest1 = output.some(function(name) { return name.indexOf("TEST_ListTest1") !== -1; });
                h.assertTrue(hasTest1, "Should include test project 1");
            }
        },
        {
            name: "list_projects --search filters by name",
            fn: function(of, doc, h) {
                h.createTestProject(of, doc, "SearchableUnique");

                var result = runScript(scriptPath, ["--search", "SearchableUnique"]);
                h.assertEqual(result.exitCode, 0, "Script should exit successfully");

                var output = JSON.parse(result.output);
                h.assertTrue(Array.isArray(output), "Should return array");
                h.assertTrue(output.length >= 1, "Should find at least one match");

                var hasMatch = output.some(function(name) { return name.indexOf("SearchableUnique") !== -1; });
                h.assertTrue(hasMatch, "Should find the searchable project");
            }
        },
        {
            name: "list_projects --count returns objects with counts",
            fn: function(of, doc, h) {
                h.createTestProject(of, doc, "CountTest");

                var result = runScript(scriptPath, ["--count"]);
                h.assertEqual(result.exitCode, 0, "Script should exit successfully");

                var output = JSON.parse(result.output);
                h.assertTrue(Array.isArray(output), "Should return array");
                h.assertTrue(output.length > 0, "Should have projects");

                // Check structure
                var first = output[0];
                h.assertTrue('name' in first, "Should have name");
                h.assertTrue('taskCount' in first, "Should have taskCount");
                h.assertTrue('status' in first, "Should have status");
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
