# Noridoc: OmniFocus Tests

Path: @/omnifocus/tests

### Overview

JXA (JavaScript for Automation) test suite for OmniFocus project and tag management functionality. Provides unit tests for library functions (`_omnifocus_lib.js`) and integration tests for scripts, with safety guardrails to prevent production data corruption during test runs.

### How it fits into the larger codebase

```
@/omnifocus/scripts/
  ├── _omnifocus_lib.js         ← library functions under test
  ├── list_projects.js          ← scripts under test
  ├── create_project.js
  └── ...
                    │
                    │ tested by
                    ▼
@/omnifocus/tests/
  ├── _test_helpers.js          ← shared test utilities
  ├── test_find_existing_project.js
  ├── test_project_formatting.js
  ├── test_list_projects.js
  └── debug_test.js
```

Tests are invoked directly via `osascript -l JavaScript` and emit structured JSON output (`{ok, passed, failed, tests: [...]}`) for CI integration. They run against a live OmniFocus instance, using `TEST_` prefix guardrails to prevent accidental pollution of production data.

### Core Implementation

**Shared test utilities (`_test_helpers.js`):**
- `createTestProject(doc, name)` - Creates a project with `TEST_` prefix for safe cleanup
- `cleanupTestProjects(doc)` - Removes all projects starting with `TEST_`
- `assert(condition, message)` - Basic assertion that throws on failure
- `assertEqual(actual, expected, message)` - Deep equality assertion
- `runTests(tests)` - Test harness that runs test functions, catches errors, reports results

**Unit tests:**
- `test_find_existing_project.js` (5 tests) - Tests `findExistingProject()` lookup cascade: exact match, substring match, auto-resolve single match, ambiguous match with candidates, not found error
- `test_project_formatting.js` (3 tests) - Tests `formatProjectFull()`, `formatProjectCompact()`, and `normalizeProjectStatus()`

**Integration tests:**
- `test_list_projects.js` - Tests `list_projects.js` script with various flags (`--search`, `--status`, `--count`, `--limit`)

**Debugging utilities:**
- `debug_test.js` - Interactive debugging helpers for test development

**Test execution pattern:**
```javascript
ObjC.import("Foundation");
// Load _omnifocus_lib.js for testing
var lib = eval(loadLibrary());
// Load _test_helpers.js for test utilities
var helpers = eval(loadHelpers());

function run() {
    var app = Application("OmniFocus");
    var doc = app.defaultDocument;

    // Cleanup from previous runs
    helpers.cleanupTestProjects(doc);

    // Run tests
    return helpers.runTests([
        testExactMatch,
        testSubstringMatch,
        // ...
    ]);
}
```

### Things to Know

- **`TEST_` prefix guardrail**: All test entities (projects, tags, folders) must start with `TEST_` to prevent production data corruption. `cleanupTestProjects()` removes anything with this prefix.
- **Live OmniFocus instance**: Tests run against the user's actual OmniFocus.app, not a mock. This provides high-fidelity integration testing but requires careful cleanup.
- **JSON output format**: All tests emit `{ok: true/false, passed, failed, tests: [{name, passed, error?}]}` for programmatic result parsing and CI integration.
- **Manual invocation**: Tests are run via `osascript -l JavaScript tests/test_name.js` from the command line. No automated CI runner yet.
- **Error handling**: Test failures are caught and reported as test results (not thrown). This allows full test suite execution even when individual tests fail.
- **Path assumptions**: Tests assume they're run from the repository root and use relative paths to load libraries and helpers.

Created and maintained by Nori.
