import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Redirect the short-id cache so no test can ever touch the user's real
// cache file (~/.cache/omnifocus-cli/short-ids.json). Individual tests
// override OF_SHORT_ID_CACHE with their own temp paths as needed.
process.env.OF_SHORT_ID_CACHE = join(
	mkdtempSync(join(tmpdir(), "of-test-short-ids-")),
	"short-ids.json",
);
