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

// Same for the AI config file and prompt overrides: tests must never read
// the user's real ~/.config/omnifocus-cli, and a developer's own
// OPENROUTER_API_KEY / OF_AI_MODEL must not leak into assertions.
process.env.OF_CONFIG_DIR = mkdtempSync(join(tmpdir(), "of-test-config-"));
process.env.OF_PROMPTS_DIR = join(process.env.OF_CONFIG_DIR, "prompts");
Reflect.deleteProperty(process.env, "OPENROUTER_API_KEY");
Reflect.deleteProperty(process.env, "OF_AI_MODEL");
