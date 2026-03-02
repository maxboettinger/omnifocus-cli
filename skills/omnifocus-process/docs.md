# Noridoc: omnifocus-process

Path: @/omnifocus-process

## Overview

Inbox triage workflow skill for deterministic batch processing.

Primary commands:
- `of inbox list`
- `of inbox process`

## Architecture Alignment

This skill coordinates triage behavior and uses CLI-native inbox operations with optional `--dry-run` before apply.
