# Noridoc: omnifocus-plan

Path: @/omnifocus-plan

## Overview

Planning workflow skill built on current CLI reporting and task mutation commands.

Typical sequence:
1. `of forecast --json`
2. `of task list ... --json`
3. `of task update --id ...` for estimate/schedule adjustments
4. `of forecast --json` to validate

## Architecture Alignment

This skill is protocol-only. It no longer references legacy script entrypoints.
