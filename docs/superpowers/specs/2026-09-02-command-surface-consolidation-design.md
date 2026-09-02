# Command surface consolidation — design

Date: 2026-09-02
Status: approved design, pending implementation plan

## Goal

Turn the CLI layer into a single, uniform noun-verb surface with one-letter
noun aliases, remove the root task shortcuts, and eliminate every duplicated
definition in `src/commands/` so that each command, sub-command, option group,
argument, parser and output helper exists exactly once and is reused.

## Non-goals

- Changing the JSON contract of any surviving command (bare object / array
  shapes, stderr JSON lines, exit codes stay as they are).
- Folding `bulk` into `--stdin` flags on the task verbs. Deferred; `bulk` stays
  a noun (renamed verb only, see below).
- New OmniFocus capabilities (folder rename/delete, tag update, ...). The CRUD
  matrix stays as ragged as the bridge ops allow today.
- Backwards-compatible aliases for removed spellings. The project is 0.1.0 and
  its only consumers are the author and the agent skill, which is updated as
  part of this work.

## Decisions (with rationale)

1. **Pure noun-verb, no root verb shortcuts.** `of complete` / `of move` are
   removed. Root shortcuts only ever worked for verb names unique to one noun
   and permanently reserve root names (clig.dev's "you can never add a
   subcommand named `echo`" problem). Precedent: `gh` (pure noun-verb, users
   add their own aliases), Docker 1.13 management commands.
2. **Single-letter noun aliases, stable, nouns only.** `task|t`, `project|p`,
   `tag|g`, `folder|f`, `inbox|i`, `bulk|b`. Verbs never get aliases; prefix
   matching is never enabled. Precedent: kubectl resource short names, pnpm
   and cargo verb aliases; clig.dev: "aliases should be explicit and remain
   stable". Commander renders them as `task|t` in help.
3. **Fold verbs that are projections of another verb.**
   - `task subtask` → `task add --parent <ref> | --parent-id <id>`.
   - `inbox add` → the same `registerAddCommand` mounted under `inbox`
     (bridge: `task.create` without a project already creates an `InboxTask`,
     identical to `inbox.add`).
   - `bulk create` → `bulk add` (naming consistency with every other noun).
   - `move`, `tag`, `complete`, `rename` stay as verbs: they are thin verbs
     over `update`/dedicated ops with their own ergonomics (positional date,
     variadic refs, two positionals), which is the pattern `move` established.
4. **Every duplicated definition gets one home** (see ledger). New code must
   reuse these; a verb file contains only what is specific to that verb.

## Target command surface

```
of task|t      add list show update complete move tag delete search notification {list,add,update,delete,clear}
of project|p   add list show update rename delete
of tag|g       add list tasks rename delete
of folder|f    add list
of inbox|i     add list process process-many
of bulk|b      add update complete
of forecast · of review · of stats · of collect · of completion
```

Removed: root `complete`, root `move`, `task subtask`, `bulk create`,
`src/commands/shortcuts.ts`.

### Positional / reference conventions

| Entity  | Positional            | Explicit id | Resolution                                   |
|---------|-----------------------|-------------|----------------------------------------------|
| task    | `<ref>` / `[ref]` / `[refs...]` | `--id`      | `resolveTaskRef()` (short id → real id, else fuzzy) |
| project | `<project>`           | `--id`      | bridge fuzzy                                  |
| tag     | `<tag>`               | —           | bridge fuzzy                                  |
| folder  | `<folder>`            | —           | bridge fuzzy                                  |

`inbox process` takes `<ref>` (was `<id>`); it already resolved short ids.
`task add --parent <ref>` resolves through `resolveTaskRef()` like every task
reference; `--parent-id` is the explicit form, mirroring `<ref>` + `--id`.

## Architecture of the CLI layer after the change

```
src/commands/
  noun.ts            mountNoun(program, client, spec)  ← the ONE noun registrar
  action.ts          runAction()                        ← the ONE action wrapper
  options/
    task-fields.ts   taskDateOptions / taskCreateOptions / taskEditOptions (+ readers)
    refs.ts          taskRefArgument, projectRefArgument, tagArgument, folderArgument
    common.ts        limitOption, listQueryOptions (--search/--count/--limit/--active-only), confirmOption
  task/  project/  tag/  folder/  inbox/  bulk/
    index.ts         a NounSpec literal only (name, alias, description, verbs[])
    <verb>.ts        registerXxxCommand(parent, client) — verb-specific code only
  forecast.ts review.ts stats.ts collect.ts completion.ts
```

### `mountNoun` (src/commands/noun.ts)

```ts
export interface NounSpec {
  name: string;          // "task"
  alias?: string;        // "t" — omitted for nested nouns (task notification)
  description: string;   // "Manage tasks"
  verbs: readonly Register[];
}
export function mountNoun(program: Command, client: OmniFocusClient, spec: NounSpec): Command
```

Creates `program.command(spec.name).alias(spec.alias).description(...)` and
calls every verb's register function with the noun command as parent. Each
noun `index.ts` exports its `NounSpec` and nothing else; `program.ts` mounts
the six specs from a single array. `task/notification/index.ts` uses the
same `mountNoun` with no alias (nested nouns are unaliased).

### `runAction` (existing, now universal)

Unchanged contract. Additions: every verb uses it; confirmation guards
`throw new ConfirmationRequiredError(action)` and let `runAction` report and
exit. The per-verb `--json` option is deleted — `runAction` already reads
`cmd.optsWithGlobals().json`, and Commander recognises program options after
subcommands by default. The test harness (`test/helpers/run.ts`) declares the
root `--json` once so verbs tested in isolation behave like the real program.

### Option groups (src/commands/options/)

Each group is `(cmd: Command) => Command` (so it chains) with a paired reader
`readXxx(opts): Partial<ClientParams>`:

| Group | Declares | Consumers |
|-------|----------|-----------|
| `taskDateOptions(cmd, { fields, clearable })` | any subset of `--due --defer --planned`; edit mode appends "or 'clear'" to help | task add (all three), task update, inbox process (all three, clearable), move (`defer`, `planned` only, clearable) |
| `taskCreateOptions` | `--note --tag --flag --estimate --project --sequential --repeat --repeat-method` + `--parent/--parent-id` | task add (both mounts) |
| `taskEditOptions` | `--name --note --note-append --tag --remove-tag --flag/--unflag --estimate(clear) --project --sequential/--parallel --repeat(clear) --repeat-method --complete/--incomplete` | task update, inbox process |
| `taskRefArgument` | `[ref]` + `--id` (variadic variant for complete) | every task verb incl. notification sub-verbs |
| `projectRefArgument` | `<project>` + `--id` | project show/update/rename/delete |
| `limitOption` | `--limit <n>` with default, paired with `outputLimitNotice` | task list/search, inbox list, tag tasks, project/tag/folder list |
| `listQueryOptions` | `--search --count --limit --active-only` | project/tag/folder list |
| `confirmOption` + `requireConfirm(opts, action)` | `--confirm` | task/project/tag delete, notification clear, inbox process(-many) |

Parsers shared in `core/parsers.ts`: `collectRepeatable` (was three private
`collect()`s), `parseIntOrClear` (was private `parseNumberOrString`).

### Output helpers (core/output.ts)

- `outputWarnings(warnings?: string[])` replaces the three copies of the
  "Partial apply warning" loop.
- `outputEntityAction(action, name, shortId?)` replaces the hand-built
  `"${Action}: ${bold(name)} (42)"` lines in complete/delete.

### Completion

`toTree()` in `completion.ts` records `aliases: cmd.aliases()`; the three
generators emit every alias wherever the name appears (bash noun list, zsh
`_describe` entries, fish `-a`). The parity test additionally asserts each
alias is present in every shell script.

## Bridge / client changes

- `task.create` accepts `parent` / `parentId` (mutually exclusive with
  `project`; error if both). With a parent, the task is pushed into the parent
  task and the response includes `parent: { id, name, project }` as
  `task.subtask` did.
- Delete ops `task.subtask` and `inbox.add`; delete `createSubtask` and
  `addInbox` from `OmniFocusClient`, `client.ts`, and the mock client.
- `TaskCreateOptions` gains `parent?`, `parentId?`; `SubtaskCreateOptions`
  is removed.

## Duplication ledger (must be empty after implementation)

| Duplicated today | Single home after |
|------------------|-------------------|
| Root `complete`/`move` mounted twice (`shortcuts.ts`) | removed |
| Six noun `index.ts` files with identical shape | `mountNoun` + `NounSpec` literals |
| `--json` declared on ~40 verbs | root option only, read by `runAction` |
| try/catch + `outputError` + `process.exit` in ~38 verbs | `runAction` |
| `if (!opts.confirm) { outputError(...); exit }` ×6 | `requireConfirm()` |
| Task field options declared in add / subtask / inbox add / update / process | `options/task-fields.ts` |
| Client-param object literals mapping opts → params (5 copies) | group readers |
| `collect()` ×3, `parseNumberOrString` ×1 | `core/parsers.ts` |
| `[query]`/`[ref]`/`<id>` + `--id` on 12 task verbs | `taskRefArgument` |
| `<query>` + `--id` on 4 project verbs | `projectRefArgument` |
| `--search/--count/--limit/--active-only` on 3 list verbs | `listQueryOptions` |
| `--limit` + `outputLimitNotice` on 5 verbs | `limitOption` |
| "Partial apply warning" loop ×3 | `outputWarnings` |
| `${Action}: ${bold(name)} (shortId)` ×2 | `outputEntityAction` |
| `task subtask` vs `task add` | `task add --parent` |
| `inbox add` vs `task add` | same register function, two mounts |
| bridge `inbox.add` vs `task.create`, `task.subtask` vs `task.create` | `task.create` |
| `bulk create` naming vs `add` | `bulk add` |

## Testing

- Update existing integration tests to the new spellings (`task add --parent`,
  `bulk add`, no root `complete`/`move`).
- New: alias dispatch (`of t list` ≡ `of task list`, all six nouns); root has
  no `complete`/`move`; `task add --parent 42` resolves the short id and calls
  `createTask` with `parentId`; `inbox add` calls `createTask`; `--json` after
  a subcommand selects JSON with no local flag; every alias appears in every
  completion script; `requireConfirm` still yields the JSON-line error and
  exit 1.
- JXA harness: `task.create` with `parent`/`parentId`, error when combined
  with `project`; removed ops are gone.
- Guard tests in `program.test.ts` (no UI import under `--json`) unchanged.

## Documentation

README (usage, short-id section, command reference), `src/commands/docs.md`,
`src/core/docs.md`, `src/jxa/docs.md`, CLAUDE.md conventions (alias rule,
option-group rule, "no root shortcuts"), and the external agent skill at
`~/.agents/skills/omnifocus-cli/SKILL.md` (currently documents `of complete`,
`of move`, `task subtask`).

## Phasing (one branch, ordered commits, all green after each)

1. Behaviour-neutral: `runAction` everywhere, option groups, shared parsers,
   output helpers, `mountNoun`, root-only `--json`, harness change.
2. Aliases + completion support; delete `shortcuts.ts` and root shortcuts.
3. Verb folding: `task add --parent`, `inbox add` remount, `bulk add`;
   bridge/client/mock cleanup.
4. Docs, CLAUDE.md, agent skill.
