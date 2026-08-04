# Phase 2 — Phase 3 attendance release evidence gate

## Objective

Define and automate the future attendance release decision while Phase 3 runtime implementation remains locked.

## Changes completed

- Added a strict, commit-bound Phase 3 release-evidence schema covering every acceptance domain required before pilot rollout.
- Required attendance writes to remain default-off during validation.
- Required complete authenticated teacher-mobile, admin-desktop, student-own-view, keyboard, screen-reader, zoom/reflow, reduced-motion, and Bangla-copy evidence.
- Required the approved entry base to be an ancestor of the exact clean release candidate.
- Independently revalidated the underlying Phase 2 evidence against that base and the entry-approval chronology.
- Required pilot approval to follow every recorded migration, transaction, security, UX, observability, and rollback gate.
- Restricted eligibility to one named pilot branch and rejected unknown fields or broader authority.
- Added `npm.cmd run check:attendance-release`, a read-only checker that never connects to MongoDB or changes a feature flag.
- Added schema, chronology, placeholder, path-containment, commit-binding, default-off, and accessibility-coverage tests.

## Safety boundary

This slice adds no attendance models, collections, indexes, migrations, APIs, pages, navigation, feature flags, database connections, writes, workflow dispatches, or deployments. A valid future report can state only `eligible-for-scoped-pilot`; `attendanceRuntimeUnlocked` always remains false.

## Current status

No approved Phase 2 evidence, Phase 3 entry authorization, implementation, or Phase 3 release evidence exists in this workspace. The release checker therefore reports blocked.
