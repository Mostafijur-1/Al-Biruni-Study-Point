# Phase 2 — Commit-bound Phase 3 authorization

## Objective

Turn the required explicit Phase 3 decision into a bounded, machine-verifiable gate without adding attendance runtime behavior.

## Changes completed

- Added a strict Phase 3 authorization schema limited to `phase3-attendance-first-slice` contract version 1.
- Required the authorization and reviewed Phase 2 evidence to match the current base commit, with approval occurring after the final recorded evidence gate.
- Rejected commit-bound evidence when the Git worktree is dirty or unverifiable.
- Required an approver, timestamp, evidence reference, and change-control reference.
- Required `runtimeWriteRolloutApproved` to remain `false`; unknown authority fields are rejected.
- Added path containment, placeholder, scope, stale-commit, missing-evidence, and runtime-authority tests.
- Extended the read-only readiness report with authorization state, `phase3ImplementationAuthorized`, and the `--require-phase3-authorization` enforcement option.
- Added the example artifact and operator workflow while retaining approved artifacts under the existing `evidence/*.approved.json` ignore boundary.

## Safety boundary

This slice adds no attendance models, collections, indexes, migrations, API routes, pages, navigation, flags, writes, database connections, or external workflow dispatch. Even a valid authorization keeps `phase3Unlocked` false because runtime rollout is a later, separately evidenced decision.

## Current status

The local report remains blocked because the approved academic bootstrap manifest, reviewed Phase 2 evidence, and explicit Phase 3 authorization artifact are absent. Academic and attendance writes remain disabled.
