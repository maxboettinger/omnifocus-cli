# Noridoc: omnifocus-inbox

Path: @/omnifocus-inbox

## Overview

Capture workflow skill for turning natural-language input into actionable OmniFocus items.

Primary commands:
- `of inbox add`
- `of task add --project ...` (when direct project placement is explicit)
- `of task subtask` (for decomposition)

## Architecture Alignment

This skill defines behavior and routing only. Command specifics live in `@/omnifocus-tasks`.
