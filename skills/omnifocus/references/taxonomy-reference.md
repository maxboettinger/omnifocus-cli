# OmniFocus Taxonomy Reference (CLI-Compatible)

This reference defines naming and tagging conventions used during capture, planning, and triage.

## Task Naming

Write task names as concrete actions:
- Start with a verb
- Include enough context to execute without guesswork
- Keep one actionable unit per task

Examples:
- "Call dentist and book checkup"
- "Draft invoice for March consulting"
- "Review PR #482 and leave feedback"

## Optional Prefix Convention

If your workflow uses visual prefixes, keep a stable order:

`[status] [priority] [deadline-rigidity] [effort] task text`

Example:
- `TODO P1 FIXED E3 Submit tax declaration`

Use plain-text tokens or emoji tokens consistently; do not mix arbitrary formats.

## Tagging Principles

Use tags for context and filtering, not for duplicating every attribute in the task title.

Recommended categories:
- Context: `home`, `office`, `errands`, `phone`, `computer`
- Energy/Effort: `low-energy`, `deep-work`, `quick-win`
- Ownership: people- or team-specific tags
- Priority tiers: if used, keep meaning stable and documented

## Date Semantics

- `due`: external commitment date
- `defer`: earliest start date (hidden until then)
- `planned`: intended execution date
- `notification`: reminder timing (absolute datetime or due-relative offset)

Set only what is known. Avoid filling all three fields by default.

## Estimate Semantics

Use `estimatedMinutes` for execution planning.

Rules of thumb:
- Add estimates when they influence scheduling decisions
- Update estimates after real execution feedback
- Split tasks that exceed practical focus windows into subtasks

## CLI Mapping

- Add/capture: `of inbox add` or `of task add`
- Reclassify metadata: `of task update` or `of inbox process`
- Manage reminders: `of task notification list|add|update|delete|clear`
- Decompose: `of task subtask`
- Filter by tags/priorities: `of task list`, `of task search`, `of tag tasks`
