# Noridoc: omnifocus-tags

Path: @/omnifocus-tags

## Overview

Tag management and tag-oriented discovery skill.

Primary commands:
- `of tag add|list|rename|delete|tasks`
- tag application via task/inbox mutation commands

## Architecture Alignment

This skill handles tag namespace operations and routes assignment/removal to `@/omnifocus-tasks` commands.
Reminder/notification mutations remain task-level operations via `of task notification ...`.
