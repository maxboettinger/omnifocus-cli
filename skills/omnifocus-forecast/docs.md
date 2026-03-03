# Noridoc: omnifocus-forecast

Path: @/omnifocus-forecast

## Overview

CLI-first reporting skill for execution visibility.

Primary commands:
- `of forecast`
- `of review`
- `of stats`

## Architecture Alignment

This skill is read-heavy and should be paired with mutation commands from `@/omnifocus-tasks` when follow-up actions are required.
Follow-up can include task notification adjustments (`of task notification ...`) when reminder timing is part of execution planning.

Legacy `osascript` script references are intentionally removed; this skill follows the consolidated `of` command architecture.
