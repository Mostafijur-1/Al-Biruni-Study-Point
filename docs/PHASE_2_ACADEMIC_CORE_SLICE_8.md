# Phase 2 — Manual cached database validation

## Objective

Make the large first-time MongoDB binary download and real transactional harness practical and reviewable without adding cost to ordinary installs, pushes, or pull requests.

## Changes completed

- Replaced the umbrella memory-server dependency with `mongodb-memory-server-core`, avoiding its install-time binary-download hook.
- Added the manual-only `Phase 2 Academic DB Validation` GitHub Actions workflow.
- Cached the MongoDB test binary by runner OS and selected MongoDB version.
- Installed dependencies with lifecycle scripts disabled, ran unit/contracts first, then executed the isolated replica-set harness.
- Captured the full integration output with pipe-failure preservation and uploaded it for 14-day human review.
- Restricted workflow permissions to repository contents read-only and supplied no secrets.
- Added contract tests preventing push/pull-request triggers and accidental reintroduction of the install-time download package.

## How to run

Open GitHub Actions, choose `Phase 2 Academic DB Validation`, select the exact commit/branch, confirm the MongoDB version, and dispatch it manually. Review the uploaded log and job summary. A green job is evidence input, not automatic rollout approval.

## Safety boundary

The workflow creates only a temporary loopback database named `absp_academic_memory_test`. It does not read `MONGODB_URI`, does not receive repository secrets, and does not enable academic writes or Phase 3.
