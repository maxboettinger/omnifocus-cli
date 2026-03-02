# omnifocus-cli (`of`)

A TypeScript CLI for managing OmniFocus from the terminal. Built on Bun + Commander.js, backed by a unified JXA bridge for all Apple Event communication.

## Requirements

- macOS (uses Apple Events via `osascript`)
- [Bun](https://bun.sh/) >= 1.0
- OmniFocus installed and running

## Installation

### From source (recommended)

```bash
git clone https://github.com/max/omnifocus-cli.git
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

Commands follow a noun-verb pattern: `of <noun> <verb> [args] [options]`

All commands support `--json` for machine-readable output. When stdout is piped (not a TTY), JSON is the default.

### Tasks

```bash
of task add "Buy groceries" --due 2026-03-05 --flag --tag errand
of task list --filter flagged --limit 10
of task search "groceries"
of task show "Buy groceries"
of task update --id abc123 --due 2026-04-01
of task complete "Buy groceries"
of task complete "Buy groceries" --incomplete    # mark incomplete
of task delete "Buy groceries" --confirm         # permanent deletion
of task subtask "Buy milk" --parent "Buy groceries"
of task tag "Buy groceries" --tag urgent
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
of inbox add "Quick thought"
of inbox process --id <task-id> --project "Errands" --tag errand
```

### Bulk Operations

```bash
echo '[{"name": "Task 1"}, {"name": "Task 2"}]' | of bulk create
echo '[{"id": "abc", "due": "2026-04-01"}]' | of bulk update
echo '["id1", "id2"]' | of bulk complete
```

### Reports

```bash
of forecast --days 3          # daily forecast with spoon budget
of review --days 7            # weekly review summary
of stats                      # task/project statistics
of collect --days 14          # recently completed tasks
```

## Command Reference

| Command | Description |
|---------|-------------|
| `task add` | Create a new task |
| `task list` | List tasks by filter (available, flagged, due-soon, overdue, inbox, all) |
| `task update` | Update task properties |
| `task complete` | Complete or mark incomplete |
| `task delete` | Permanently delete a task (requires `--confirm`) |
| `task search` | Search tasks by name |
| `task show` | Show task details |
| `task subtask` | Create a subtask |
| `task tag` | Apply tags to a task |
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
| `inbox add` | Add a task to the inbox |
| `inbox process` | Process an inbox task (move, tag, complete, delete) |
| `bulk create` | Create tasks from JSON (stdin) |
| `bulk update` | Update tasks from JSON (stdin) |
| `bulk complete` | Complete tasks by ID (stdin) |
| `forecast` | Daily forecast with spoon budget |
| `review` | Weekly review summary |
| `stats` | Task and project statistics |
| `collect` | List recently completed tasks |

## Development

```bash
bun test              # run all tests
bun run check         # Biome lint + format check
bun run typecheck     # TypeScript strict mode
bun run build         # compile to standalone binary: ./of
bun run dev -- task list --json   # run in dev mode
```

### Architecture

Three clean layers:

1. **CLI** (`src/commands/`) -- Commander.js commands. Parse args, call client, format output.
2. **Client** (`src/core/client.ts`) -- `OmniFocusClient` interface. Each method maps to a bridge op.
3. **Bridge** (`src/core/bridge.ts` + `src/jxa/bridge.js`) -- Single JXA script. JSON command in, JSON response out.

### Testing

Tests use mocked `OmniFocusClient` implementations -- no OmniFocus required. Integration tests verify the full command-parse-to-output flow.

```bash
bun test                           # all tests
bun test test/integration/         # integration only
bun test test/core/                # unit only
```

## License

Private.
