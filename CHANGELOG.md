# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- AI features through [OpenRouter](https://openrouter.ai/) (`OPENROUTER_API_KEY`, optional
  `~/.config/omnifocus-cli/config.json` with `ai.apiKey`/`ai.model`, `--model` per run,
  `$OF_AI_MODEL` globally; default model `google/gemini-3.8-flash`). Nothing else in the CLI
  needs a key.
- `task breakdown <ref>` (`of t b`): splits a task into granular, AuDHD-friendly nano
  subtasks using structured output, with full context (parents, project, existing and
  completed subtasks, siblings, tags) and optional `--context` text. Human mode previews the
  tree and loops apply / revise-with-feedback / quit; applying creates the whole nested tree,
  estimates, tags and sequential/parallel flags in one OmniFocus round-trip. `--json` prints
  the plan and changes nothing; `--json --apply` applies and reports per item.
- `task why [ref]` (`of t w`): an interactive "five whys" coaching session about an avoided
  task, streamed turn by turn, ending only on Esc, Ctrl-C, Ctrl-D or `/quit`.
- System prompts are Markdown files in `src/prompts/`, embedded in the binary and
  overridable per user via `~/.config/omnifocus-cli/prompts/<name>.md` or `$OF_PROMPTS_DIR`.
- Bridge ops `task.context` and `task.createTree` (also accepts a `projectId` target).

- `of fc` as a shortcut for `of forecast`. Standalone root commands can now carry a short
  alias of their own; `fc` rather than `f` because `f` is the `folder` noun.
- `task search --id <id>` looks a single task up by id instead of by keyword, accepting
  either a short id from a listing or a raw OmniFocus id. Output stays search's list
  format (a one-element array in `--json`), and unlike a keyword search it finds
  completed tasks. `task search` now requires exactly one of `<query>` or `--id`.

## [0.1.0] - 2026-09-03

First public release of `of`, a command-line interface for OmniFocus on macOS.

### Added

- Noun-verb command surface: `task`, `project`, `tag`, `folder`, `inbox`, `bulk`, plus the
  standalone `forecast`, `review`, `stats`, `collect` and `completion` commands.
- One-letter aliases for every noun (`t p g f i b`) and every verb, so
  `of t c 42` completes task 42.
- Short task ids: human-mode listings prefix each task with a small stable number that any
  task-reference argument accepts in place of a name or OmniFocus id.
- Natural-language dates everywhere a date is accepted (`tomorrow`, `fri 5pm`, `2d`,
  `next week`), resolved by OmniFocus's own parser; exact ISO forms are parsed locally.
  Every date write is read back and verified.
- `task move <ref> [due] [--defer] [--planned]` to reschedule any of a task's three dates.
- Variadic `task complete` with per-reference results and `--incomplete`.
- Task notifications: `task notification list|add|update|delete|clear`, with absolute and
  due-relative reminders and repeat intervals.
- Subtasks through `task add --parent`.
- Inbox triage: `inbox list --newest-first`, `inbox process` and JSON-driven
  `inbox process-many`.
- Bulk operations from stdin JSON: `bulk add`, `bulk update`, `bulk complete`.
- Scripting contract: JSON on stdout when piped or with `--json`, one JSON object per line on
  piped stderr, stable exit codes, `NO_COLOR`/`FORCE_COLOR` support, and no UI chrome in JSON
  mode.
- Progress spinner on stderr during OmniFocus round-trips in interactive human mode.
- Generated bash, zsh and fish completions (`of completion <shell>`) that cover every command
  and alias.
- Three-tier fuzzy entity resolution (exact, case-insensitive substring, ambiguity error with
  candidates) instead of silent guessing.
- Confirmation guard (`--confirm`) on every destructive verb.
- Actionable errors for missing Automation permission and a missing OmniFocus app.

[Unreleased]: https://github.com/maxboettinger/omnifocus-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/maxboettinger/omnifocus-cli/releases/tag/v0.1.0
