// _test_helpers.js — Test utilities for OmniFocus JXA scripts
// All test entities use "TEST_" prefix to avoid touching real data

(function() {

    var TEST_PREFIX = "TEST_";

    /**
     * Create a test project with unique name
     * @param of - OmniFocus application
     * @param doc - default document
     * @param baseName - base name for project (will be prefixed with TEST_)
     * @returns created project
     */
    function createTestProject(of, doc, baseName) {
        var name = TEST_PREFIX + baseName + "_" + Date.now();
        var project = of.Project({ name: name });
        doc.projects.push(project);
        return project;
    }

    /**
     * Create a test folder with unique name
     * @param of - OmniFocus application
     * @param doc - default document
     * @param baseName - base name for folder (will be prefixed with TEST_)
     * @returns created folder
     */
    function createTestFolder(of, doc, baseName) {
        var name = TEST_PREFIX + baseName + "_" + Date.now();
        var folder = of.Folder({ name: name });
        doc.folders.push(folder);
        return folder;
    }

    /**
     * Delete all test projects (cleanup)
     * @param of - OmniFocus application
     * @param doc - default document
     */
    function cleanupTestProjects(of, doc) {
        var projects = doc.flattenedProjects();
        var deleted = 0;
        for (var i = projects.length - 1; i >= 0; i--) {
            var proj = projects[i];
            if (proj.name().indexOf(TEST_PREFIX) === 0) {
                of.delete(proj);
                deleted++;
            }
        }
        return deleted;
    }

    /**
     * Delete all test folders (cleanup)
     * @param of - OmniFocus application
     * @param doc - default document
     */
    function cleanupTestFolders(of, doc) {
        var folders = doc.flattenedFolders();
        var deleted = 0;
        for (var i = folders.length - 1; i >= 0; i--) {
            var fldr = folders[i];
            if (fldr.name().indexOf(TEST_PREFIX) === 0) {
                of.delete(fldr);
                deleted++;
            }
        }
        return deleted;
    }

    /**
     * Assert equality and throw if not equal
     */
    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error("Assertion failed: " + message + "\n  Expected: " + JSON.stringify(expected) + "\n  Actual: " + JSON.stringify(actual));
        }
    }

    /**
     * Assert truthiness
     */
    function assertTrue(value, message) {
        if (!value) {
            throw new Error("Assertion failed: " + message);
        }
    }

    /**
     * Assert falsiness
     */
    function assertFalse(value, message) {
        if (value) {
            throw new Error("Assertion failed: " + message);
        }
    }

    /**
     * Run a test function with setup/cleanup
     * @param name - test name
     * @param testFn - test function(of, doc, helpers)
     * @returns test result { ok, name, error? }
     */
    function runTest(name, testFn) {
        var of = Application('OmniFocus');
        var doc = of.defaultDocument;

        try {
            testFn(of, doc, {
                createTestProject: createTestProject,
                createTestFolder: createTestFolder,
                assertEqual: assertEqual,
                assertTrue: assertTrue,
                assertFalse: assertFalse
            });
            return { ok: true, name: name };
        } catch (e) {
            return { ok: false, name: name, error: e.message };
        } finally {
            // Cleanup after each test
            cleanupTestProjects(of, doc);
            cleanupTestFolders(of, doc);
        }
    }

    /**
     * Run multiple tests and report results
     * @param tests - array of { name, fn }
     * @returns summary { total, passed, failed, results }
     */
    function runTests(tests) {
        var results = [];
        var passed = 0;
        var failed = 0;

        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            var result = runTest(test.name, test.fn);
            results.push(result);
            if (result.ok) {
                passed++;
            } else {
                failed++;
            }
        }

        return {
            total: tests.length,
            passed: passed,
            failed: failed,
            results: results
        };
    }

    return {
        TEST_PREFIX: TEST_PREFIX,
        createTestProject: createTestProject,
        createTestFolder: createTestFolder,
        cleanupTestProjects: cleanupTestProjects,
        cleanupTestFolders: cleanupTestFolders,
        assertEqual: assertEqual,
        assertTrue: assertTrue,
        assertFalse: assertFalse,
        runTest: runTest,
        runTests: runTests
    };

})()
