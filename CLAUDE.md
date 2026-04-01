# CLAUDE.md — Production-Grade Agent Directives

## Pre-Work
- Delete before building: Remove dead code/files first
- Phased execution: Max 5 files per phase, verify each
- Plan separate from build: No code until plan approved

## Understanding Intent
- Follow references: Study existing patterns before building
- Work from raw data: Trace actual errors, don't guess
- One-word mode: "yes"/"do it" = execute, no commentary

## Code Quality
- Senior dev override: Fix structural issues, not band-aids
- Forced verification: Never report done without testing
- Write human code: No robotic comments
- Don't over-engineer: Simple and correct

## Context Management
- Sub-agent swarming: Parallel agents for multi-file tasks
- Context decay: Re-read files after 10+ messages
- File read budget: Chunk reads for files >500 lines

## Edit Safety
- Edit integrity: Verify before AND after every edit
- No semantic search: Use grep, check all references
- One source of truth: Never duplicate state

## Self-Evaluation
- Verify before reporting: Re-read all modifications
- Bug autopsy: Explain WHY, not just fix
- Fresh eyes pass: Test as new user
