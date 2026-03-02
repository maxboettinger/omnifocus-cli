#!/usr/bin/env osascript -l JavaScript

function run(args) {
    try {
        var of = Application('OmniFocus');
        var doc = of.defaultDocument;

        console.log("OmniFocus accessible: YES");

        var projects = doc.flattenedProjects();
        console.log("Projects count: " + projects.length);

        // Try creating a test project
        var testName = "TEST_Debug_" + Date.now();
        var proj = of.Project({ name: testName });
        doc.projects.push(proj);
        console.log("Created test project: " + testName);

        // Try to find it
        var allProjects = doc.flattenedProjects();
        for (var i = 0; i < allProjects.length; i++) {
            if (allProjects[i].name() === testName) {
                console.log("Found test project!");
                // Delete it
                of.delete(allProjects[i]);
                console.log("Deleted test project");
                break;
            }
        }

        return JSON.stringify({ ok: true, message: "Debug successful" });

    } catch (e) {
        console.log("Error: " + e.message);
        return JSON.stringify({ ok: false, error: e.message, stack: e.stack });
    }
}
