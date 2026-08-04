# Phase 2 — Reviewed rollout evidence

## Objective

Make external gate completion auditable and commit-specific without storing credentials, raw database output, or local approval artifacts in Git.

## Changes completed

- Added a bounded staging evidence schema covering database integration, bootstrap dry-run/apply, scope parity, shadow reads, browser validation, and academic-write rollout approval.
- Required completion timestamps, named reviewers, and bounded report/change references for every gate.
- Required explicit mobile, desktop, keyboard, and screen-reader browser results.
- Bound evidence to the current Git commit so stale validation cannot qualify later code.
- Added a placeholder example that intentionally fails validation until every value is reviewed and replaced.
- Ignored `evidence/*.approved.json` so local/CI approval artifacts and reviewer details are not committed accidentally.
- Extended the readiness command with `--require-evidence`. Even valid evidence reports only eligibility for explicit Phase 3 authorization; it never enables attendance.

## Workflow

1. Run every external gate on one staging commit.
2. Copy `docs/phase2-rollout-evidence.example.json` to `evidence/phase2-rollout-evidence.approved.json`.
3. Replace every placeholder with reviewed evidence references and the tested commit.
4. Run `npm.cmd run check:academic-readiness -- --strict --require-evidence` on that same commit.
5. Request explicit authorization before beginning Phase 3 attendance work.

## Current status

No approved manifest, disposable MongoDB configuration, or rollout evidence is present. Academic writes and Phase 3 remain disabled. This slice performs no database or external-system mutation.
