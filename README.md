# omnifocus-cli (`of`)

A TypeScript CLI for managing OmniFocus from the terminal. Built on Bun + Commander.js, backed by a unified JXA bridge for all Apple Event communication.

> This is an unofficial, community project and is not affiliated with or endorsed by
> [The Omni Group](https://www.omnigroup.com/). OmniFocus is a trademark of The Omni Group.

## Requirements

- macOS (uses Apple Events via `osascript`) — on other platforms the CLI exits with a clear error
- [Bun](https://bun.sh/) >= 1.0
- OmniFocus installed and running
- For the AI commands only: an [OpenRouter](https://openrouter.ai/) API key (see [AI features](#ai-features))

### First run: Automation permission

The first command that talks to OmniFocus triggers a macOS prompt asking to allow your
terminal to control OmniFocus. If you decline (or the prompt never appeared), commands fail
with guidance to fix it: open **System Settings → Privacy & Security → Automation**, find
your terminal app, and enable **OmniFocus**.

## Installation

### Homebrew (recommended)

```bash
brew install maxboettinger/tap/omnifocus-cli
```

This installs `of` together with bash, zsh and fish completions. Homebrew 6 asks you to
trust a third-party tap once; if the install refuses to load the formula, run
`brew trust maxboettinger/tap` and retry.

### Prebuilt binary

Each [GitHub release](https://github.com/maxboettinger/omnifocus-cli/releases) ships a
standalone `of` binary for Apple Silicon and Intel Macs. No Bun required.

```bash
curl -fsSL https://github.com/maxboettinger/omnifocus-cli/releases/latest/download/of-darwin-arm64.tar.gz | tar -xz
xattr -d com.apple.quarantine of   # the binary is not notarized; clear Gatekeeper's flag
mv of ~/.local/bin/                 # or /usr/local/bin
```

Use `of-darwin-x64.tar.gz` on an Intel Mac. A `checksums.txt` next to the archives lists
their SHA-256 sums.

### From source

```bash
git clone https://github.com/maxboettinger/omnifocus-cli.git
cd omnifocus-cli
bun install
```

### Add to PATH

To make `of` available system-wide (including for other agents/tools):

```bash
# Option 1: bun link (creates a global symlink)
bun link

# Option 2: compile to standalone binary
bun run build        # produces ./of
cp of /usr/local/bin/  # or ~/.local/bin/
```

After linking or installing, verify:

```bash
of --version
```

## Usage

Commands follow a noun-verb pattern: `of <noun> <verb> [args] [options]`. Every noun has a
one-letter alias — `of t list` is `of task list`, `of p`, `of g` (tag), `of f`, `of i`, `of b`
— and every verb has one too, so `of t c 42` completes task 42 and `of t n l 42` lists its
notifications. Aliases are fixed letters, never prefixes, so they stay stable as verbs are
added; `of <noun> --help` shows them as `complete|c`. Flags are never abbreviated.
The standalone reports keep their own short spellings where the single letter is taken:
`of fc` is `of forecast`.

All commands support `--json` for machine-readable output. When stdout is piped (not a TTY), JSON is the default.

### Short task IDs

Every task shown in a human-readable listing (`task list`, `task search`, `task show`,
`forecast`, `collect`) is prefixed with a small number:

```
$ of task list
 42  ⚑ Buy milk Errands [shopping] due:2026-09-01
127  Call the dentist Health
```

Any command that takes a task reference accepts that number in place of a name or the
full OmniFocus ID:

```bash
of t complete 42                 # short for `of task complete 42`
of t complete 42 127             # several at once
of t move 42 tomorrow            # short for `of task move 42 tomorrow`
of task update 42 --due 2026-04-01
of task delete 127 --confirm
of task search --id 42           # `task search --id` takes a number too
```

A number always refers to the same task once assigned, and numbers are never reused — a
stale or pruned number resolves to "not found" rather than a different task. Numbers are
cached at `~/.cache/omnifocus-cli/short-ids.json` (override with `$XDG_CACHE_HOME` or
`$OF_SHORT_ID_CACHE`). This is purely a human-mode convenience: `--json` output and piped
output always carry the real OmniFocus ID, never the short number.

### Scripting contract

Built for both humans and scripts/agents:

- **stdout**: human-formatted on a terminal, JSON when piped or with `--json`.
- **stderr**: human-readable messages on a terminal; when piped, one JSON object per line —
  errors as `{"ok": false, "error": "...", "candidates": [...]?}` (mirroring the bridge
  protocol) and warnings as `{"warning": "..."}`.
- **Exit codes**: `0` on success, `1` on any error (including missing `--confirm`).
- **Colors**: ANSI colors only on a terminal; [`NO_COLOR`](https://no-color.org/) disables
  them, `FORCE_COLOR` forces them.
- **Progress**: in human mode on an interactive terminal, a spinner on stderr shows which
  OmniFocus round-trip is in flight and is erased before output appears. It never appears in
  JSON mode (`--json` or piped stdout), under `CI`, or on `TERM=dumb` — the JSON interface is
  for agents and carries no UI chrome at all.

### Tasks

```bash
of task add "Buy groceries" --due 2026-03-05 --flag --tag errand
of task list --filter flagged --limit 10
of task search "groceries"
of task search --id 42                           # look one task up by short id or OmniFocus id
of task show "Buy groceries"
of task update --id abc123 --due 2026-04-01
of task complete "Buy groceries"
of task complete "Buy groceries" --incomplete    # mark incomplete
of t complete 42 43 "Call mom"                   # several refs; each reported, exit 1 if any failed
of task move 42 tomorrow                         # reschedule due date
of task move 42 "fri 5pm" --defer mon --planned thu   # any of the three dates, combinable
of task move 42 clear                            # remove the due date
of task delete "Buy groceries" --confirm         # permanent deletion
of task add "Buy milk" --parent "Buy groceries"
of task tag "Buy groceries" --tag urgent
of task notification list --id abc123
of task notification add --id abc123 --kind absolute --at 2026-03-05T09:00 --repeat 1h
of task notification update --id abc123 --notification-id notif-1 --repeat clear
of task notification delete --id abc123 --notification-id notif-1
of task notification clear --id abc123 --confirm
```

`task complete` takes any number of task references (short ids, names, or a single `--id`). With
one reference the JSON output is the completed task object, exactly as before. With several,
every reference is attempted in order and the JSON output is an array of per-reference
results — `{"ref", "ok": true, ...task}` or `{"ref", "ok": false, "error", "candidates"?}` —
and the exit code is `1` if any of them failed.

### Dates

Every date option (`--due`, `--defer`, `--planned`, and `task move`'s positional) accepts what
OmniFocus's own date fields accept, because the CLI hands the text to OmniFocus's parser:

```bash
of t move 42 tomorrow          of t move 42 "fri 5pm"        of t move 42 2d
of t move 42 "next week"       of t move 42 10.9.            of t move 42 noon
of task add "Call mom" --due sat --defer "tom 9am"
```

When the text names a day but no time, the app's default time for that field (Preferences →
Dates & Times: due, defer, planned) is applied, exactly as typing it into OmniFocus would.
Exact ISO forms (`2026-09-10`, `2026-09-10T14:30`) are parsed locally and unchanged: a bare
ISO date stays at midnight, so existing scripts keep their behavior. `clear` removes a date.

Every date write is read back from OmniFocus and compared; a value the app did not store
is reported as an error, never as a success. The confirmation lists every date the task now
carries, in planned → defer → due order, with the ones you changed highlighted:

```
$ of t move 13 tomorrow
✓ Moved: Pay the invoice (13)
  • Planned: Wed, Sep 2, 2026 at 09:00 AM
  ● Due: Thu, Sep 3, 2026 at 06:00 PM
```
 Text OmniFocus cannot parse fails with
`Could not understand date "..."` before anything is changed, and the `changes` list in the
result shows the resolved time (`due: tomorrow → 2026-09-03T18:00`).

Duration flags (`--offset`, `--repeat`) accept `[-+]?((\\d+h)?(\\d+m)?(\\d+s)?)` such as `-1h`, `30m`, `1h30m`, `90s`, `+2h15m`. Explicit zeros are valid: `--offset 0s` fires a due-relative notification exactly at the due time.

### Task Notifications

```bash
# list notifications on a task
of task notification list --id abc123

# add absolute reminder
of task notification add --id abc123 --kind absolute --at 2026-03-05T09:00

# add due-relative reminder (for example, 1 hour before due date)
of task notification add --id abc123 --kind due-relative --offset -1h

# update repeat interval or clear it
of task notification update --id abc123 --notification-id notif-1 --repeat 2h
of task notification update --id abc123 --notification-id notif-1 --repeat clear

# delete one reminder / clear all reminders
of task notification delete --id abc123 --notification-id notif-1
of task notification clear --id abc123 --confirm
```

### Projects

```bash
of project add "Home Reno" --sequential --folder Personal
of project list --status active
of project show "Home Reno"
of project update "Home Reno" --status onhold
of project rename "Home Reno" "Kitchen Remodel"
of project delete "Home Reno" --confirm
```

### Tags

```bash
of tag add urgent
of tag list --count
of tag tasks errand --limit 20
of tag rename old-name new-name
of tag delete old-name --confirm
```

### Folders

```bash
of folder add Personal --parent Life
of folder list --search Work --count
```

### Inbox

```bash
of inbox list --limit 10
of inbox add "Quick thought"                      # same command as task add; lands in the inbox
of inbox add "Call bank" --project Finance        # --project files it into the project, like task add
of inbox process <ref> --project "Errands" --tag errand
echo '[{"id":"id1","project":"Errands"},{"id":"id2","complete":true}]' | of inbox process-many
```

### Bulk Operations

```bash
echo '[{"name": "Task 1"}, {"name": "Task 2"}]' | of bulk add
echo '[{"id": "abc", "due": "2026-04-01"}]' | of bulk update
echo '["id1", "id2"]' | of bulk complete
```

Bulk commands (and `inbox process-many`) read their JSON payload from stdin and error
immediately with a usage example if nothing is piped. Arbitrarily large payloads are safe —
oversized commands are streamed to the bridge instead of passed as process arguments.

### AI features

Two verbs talk to a language model through [OpenRouter](https://openrouter.ai/). They need an
API key, and nothing else in the CLI does — every other command works without one.

```bash
export OPENROUTER_API_KEY=sk-or-...        # or put it in the config file below
export OF_AI_MODEL=openai/gpt-4.1-mini     # optional; default is google/gemini-2.5-flash
```

Config file: `~/.config/omnifocus-cli/config.json` (`$XDG_CONFIG_HOME` respected):

```json
{ "ai": { "apiKey": "sk-or-...", "model": "google/gemini-2.5-flash" } }
```

Precedence is `--model` flag > `$OF_AI_MODEL` > config file > default; the key comes from
`$OPENROUTER_API_KEY`, else the config file. Any model id OpenRouter routes works
(`openrouter/auto`, `:nitro`/`:floor` suffixes included), but `task breakdown` needs a model
that supports strict JSON-schema output.

**Break a task into nano tasks** — granular, single-action subtasks designed for people for
whom starting is the hard part (the prompt is AuDHD-aware: an ignition step first, one
observable action per task, 2–10 minutes each, implicit prep made explicit, no vague verbs):

```bash
of task breakdown 42                           # or `of t b 42`
of task breakdown 42 --context "I only have the evenings this week"
```

The model sees the whole picture — the task, its parents, its project, subtasks that already
exist (completed ones included), its siblings and your tag list — and answers with a
structured plan. You get a preview:

```
Plan for: File the tax return — new subtasks in order
Ignition first, then the portal.

1 Open the tax portal in the browser 1min
2 Find last year's return PDF in ~/Documents/Taxes 3min [@computer]
3 Log in with the ID card app (in order) 5min
  3.1 Plug in the card reader 1min
  3.2 Enter the PIN 1min

5 tasks, ~11 min total

[a]pply, [r]evise or [q]uit:
```

`r` asks what should change and sends your feedback back with the full conversation, as often
as you like; `a` creates the whole tree in one OmniFocus round-trip (nesting, estimates, tags,
sequential/parallel on every level, and the target task's own ordering); `q`, Esc or Ctrl-C
changes nothing. `--apply` skips the preview.

For scripts and agents: `of task breakdown 42 --json` prints `{ target, model, plan,
applied: null }` and never touches OmniFocus; add `--apply` to create the tasks and get
`applied` (the per-item result, exit 1 if any item failed).

**Work out why you are avoiding something** — a "five whys" coaching session:

```bash
of task why 42                                 # or `of t w 42`
of task why                                    # no task, start from "what are you avoiding?"
```

The coach asks one question at a time, adapts to your answers, and keeps going until you leave
with Esc, Ctrl-C, Ctrl-D or `/quit`. It is a terminal-only session: it refuses `--json` and
piped stdin.

**Prompts are plain Markdown** in [`src/prompts/`](src/prompts/) (`why.md`, `breakdown.md`).
They are embedded in the binary, and any of them can be overridden without rebuilding by
putting a file of the same name in `~/.config/omnifocus-cli/prompts/` (or `$OF_PROMPTS_DIR`).

### Shell completions

```bash
of completion bash   # or zsh, fish
```

Completion scripts are generated from the live command tree, so they always match the
installed version. For example: `of completion zsh > ~/.zfunc/_of`.

### Reports

```bash
of forecast --days 3          # today's categorized task view (of fc)
of review --days 7            # weekly review summary
of stats                      # task/project statistics
of collect --days 14          # recently completed tasks
```

## Command Reference

| Command | Description |
|---------|-------------|
| `task add` | Create a new task; add `--parent`/`--parent-id` to create it as a subtask |
| `task list` | List tasks by filter (available, flagged, due-soon, overdue, inbox, all) |
| `task update` | Update task properties |
| `task complete` | Complete (or reopen with `--incomplete`) one or more tasks |
| `task move` | Reschedule a task's due (positional), `--defer`, `--planned` dates |
| `task delete` | Permanently delete a task (requires `--confirm`) |
| `task search` | Search tasks by name, or look one up with `--id` |
| `task show` | Show task details |
| `task notification list` | List notifications on a task |
| `task notification add` | Add a notification to a task |
| `task notification update` | Update an existing task notification |
| `task notification delete` | Delete a task notification |
| `task notification clear` | Clear all task notifications (requires `--confirm`) |
| `task tag` | Apply tags to a task |
| `task breakdown` | AI: split a task into nano subtasks, preview, revise, apply (`--json` prints the plan) |
| `task why` | AI: interactive five-whys session about an avoided task |
| `project add` | Create a new project |
| `project list` | List projects |
| `project show` | Show project details |
| `project update` | Update project properties |
| `project rename` | Rename a project |
| `project delete` | Delete a project (requires `--confirm`) |
| `tag add` | Create a new tag |
| `tag list` | List all tags |
| `tag tasks` | List tasks with a specific tag |
| `tag rename` | Rename a tag |
| `tag delete` | Delete a tag (requires `--confirm`) |
| `folder add` | Create a new folder |
| `folder list` | List folders |
| `inbox list` | List inbox tasks |
| `inbox add` | Create a task in the inbox, same command as `task add`; `--project` files it |
| `inbox process` | Process an inbox task (move, tag, complete, delete) |
| `inbox process-many` | Process inbox tasks from JSON (stdin) |
| `bulk add` | Create tasks from JSON (stdin) |
| `bulk update` | Update tasks from JSON (stdin) |
| `bulk complete` | Complete tasks by ID (stdin) |
| `forecast` (`fc`) | Daily categorized forecast (overdue, due, planned, upcoming) |
| `review` | Weekly review summary |
| `stats` | Task and project statistics |
| `collect` | List recently completed tasks |
| `t p g f i b` | One-letter aliases for task, project, tag, folder, inbox, bulk |

Verb aliases, per noun (`of <noun> --help` lists them):

| Noun | Verb aliases |
|------|--------------|
| `task` | `a`dd `l`ist `s`how `f` search `u`pdate `m`ove `c`omplete `g` tag `d`elete `n`otification `b`reakdown `w`hy |
| `task notification` | `l`ist `a`dd `u`pdate `d`elete `c`lear |
| `project` | `a`dd `l`ist `s`how `u`pdate `r`ename `d`elete |
| `tag` | `a`dd `l`ist `t`asks `r`ename `d`elete |
| `folder` | `a`dd `l`ist |
| `inbox` | `l`ist `a`dd `p`rocess (`process-many` has none) |
| `bulk` | `a`dd `u`pdate `c`omplete |

## Development

```bash
bun test              # run all tests
bun run check         # Biome lint + format check
bun run typecheck     # TypeScript strict mode
bun run build         # compile to standalone binary: ./of
bun run dev -- task list --json   # run in dev mode
scripts/build-release.sh          # both Mac binaries + checksums into dist/
```

### Releasing

Bump `version` in `package.json`, add the matching section to `CHANGELOG.md`, commit, and push
a `vX.Y.Z` tag. The release workflow builds the binaries, creates the GitHub release with the
changelog section as notes, publishes to npm, and updates the Homebrew tap.

### Architecture

Three clean layers:

1. **CLI** (`src/commands/`) -- Commander.js commands. Parse args, call client, format output. Assembled by `src/program.ts`; `src/index.ts` is the thin executable entry point.
2. **Client** (`src/core/client.ts`) -- `OmniFocusClient` interface. Each method maps to a bridge op.
3. **Bridge** (`src/core/bridge.ts` + `src/jxa/bridge.js`) -- Single JXA script. JSON command in, JSON response out. Commands over 128KB are piped through stdin (`@stdin` sentinel) to stay clear of ARG_MAX.

Human-mode presentation is split from those layers: `src/core/output.ts` renders OmniFocus
entities, and `src/core/ui/` holds entity-agnostic terminal primitives (ANSI colors,
interactivity detection, the progress spinner, the interactive prompter). The spinner is a
decorator over the client (`withProgress`) wired once in `src/index.ts`, so commands never
know it exists.

The language model is a second injected seam beside the OmniFocus client: `src/core/ai/`
defines an `AIClient` interface (`chat`, `stream`, `structured`), config resolution, the
prompt loader and the OpenRouter adapter — the only module that imports the SDK, and only
lazily, so runs that never use a model never load it. `buildProgram(client, ai)` threads both
clients into every verb.

### Testing

Tests use mocked `OmniFocusClient` implementations and a scripted fake `AIClient` -- no
OmniFocus and no network required. Integration tests verify the full command-parse-to-output
flow, including the interactive preview/revise loop through a fake terminal. The OpenRouter
adapter is tested with the real SDK against a local fake HTTP endpoint.

```bash
bun test                           # all tests
bun test test/integration/         # integration only
bun test test/core/                # unit only
```

## License

[MIT](LICENSE)
