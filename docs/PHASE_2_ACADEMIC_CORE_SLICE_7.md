# Phase 2 — Disposable replica-set runner

## Objective

Allow the real Phase 2 database integration harness to run without receiving or touching any application, staging, or production database URI.

## Changes completed

- Added `mongodb-memory-server` as a development-only dependency.
- Added `npm.cmd run test:academic-db:memory`, which starts a one-member loopback replica set with `wiredTiger` transaction support.
- Injected only the generated temporary URI and fixed `absp_academic_memory_test` name into the existing production-service harness child process.
- Reused the existing destructive database-name guard, audit assertions, transaction rollback checks, transfer counters, routine collision checks, and class-session lifecycle checks.
- Guaranteed normal-path replica-set cleanup in `finally`; the temporary database is not preserved.
- Updated readiness reporting so either an explicit safe test URI or the installed in-memory runner satisfies the prerequisite to attempt database validation. Only reviewed pass evidence can satisfy the rollout gate.

## Execution result in this environment

The wrapper compiled and all unit/contract tests passed. The integration run itself did not reach the assertions because the first-time Windows MongoDB binary download is approximately 819 MB and exceeded two bounded download windows on the available connection. No `mongod` process started, no database connection was made, and the incomplete 133 MB cache plus stale lock were removed afterward.

The harness should be run on CI with a cached MongoDB binary, or on a validation machine with `MONGOMS_SYSTEM_BINARY` pointing to an installed compatible `mongod`. A successful run must still be recorded in the reviewed rollout-evidence artifact.

## Safety boundary

This runner never falls back to `MONGODB_URI`. Phase 3 remains locked until the database test actually passes alongside the bootstrap, parity, shadow-read, browser, and approval gates.
