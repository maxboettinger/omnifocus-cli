# Noridoc: omnifocus-tasks

Path: @/omnifocus-tasks

## Overview

Canonical task operations skill for omnifocus-cli.

Coverage:
- `of task ...` (CRUD/search/subtask/tag)
- `of task notification ...` (task notification CRUD)
- `of inbox ...` (list/add/process)
- `of bulk ...` (stdin JSON create/update/complete)

## Architecture Alignment

This is the main operational skill for task data. It replaces legacy script-level guidance with consolidated CLI usage.
