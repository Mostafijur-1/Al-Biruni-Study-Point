# Phase 2 — Locked Phase 3 attendance entry package

## Objective

Prepare a precise, reviewable Phase 3 attendance specification without violating the Phase 2 operational gate or creating dormant runtime surface area.

## Changes completed

- Added `PHASE_3_ATTENDANCE_ENTRY_CONTRACT.md` with the authoritative sheet, record, correction, roster, concurrency, idempotency, authorization, privacy, calculation, accessibility, event, rollout, and rollback rules.
- Added `PHASE_3_ATTENDANCE_ACCEPTANCE_MATRIX.md` with traceable Given/When/Then evidence requirements for gates, transactions, concurrency, scope, corrections, calculations, UX, privacy, and operations.
- Bound the first slice to the application's current admin/teacher/student role model while preserving the broader target permission matrix for a separately reviewed role migration.
- Defined guardian notifications as a later replay-safe outbox consumer rather than weakening guardian identity requirements early.
- Kept the work design-only: no attendance model, collection, index, route, page, navigation item, flag, migration, database write, or external workflow dispatch was added.

## Current gate state

Phase 3 implementation remains locked. The approved bootstrap manifest, reviewed external rollout evidence, authenticated browser evidence, and explicit Phase 3 authorization are not present in this workspace. The manual database workflow exists but has not been dispatched or reviewed here.

## Next authorized action

An authorized operator should complete the Phase 2 operational gates in `PHASE_2_COMPLETION_GATE.md` on the exact candidate commit. After evidence validation and explicit approval, implementation begins with schemas, indexes, pure policies, database tests, and a dedicated default-off attendance flag in the order defined by the entry contract.
