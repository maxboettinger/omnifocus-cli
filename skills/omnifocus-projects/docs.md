# Noridoc: omnifocus-projects

Path: @/omnifocus-projects

## Overview

Project and folder management skill for the current CLI.

Primary commands:
- `of project add|list|show|update|rename|delete`
- `of folder add|list`

## Architecture Alignment

Use discover-first flows and ID-based updates where possible. Deletion remains explicit via `--confirm`.
Task reminders are outside project namespace operations and should use `of task notification ...`.
