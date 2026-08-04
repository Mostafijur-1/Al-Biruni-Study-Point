# 20 — Migration Strategy

## Principles

Expand → dual-write/backfill → verify → switch reads → contract. Never delete production fields/collections in the same release that introduces replacements.

## Stage 0 — Safety

1. Confirm database ownership, backup policy and restore procedure.
2. Add migration ledger and CLI requiring explicit environment and confirmation.
3. Capture baseline collection counts, required-field/null distributions and orphan checks without exporting sensitive values.
4. Add AuditLog and disable destructive academic endpoints.
5. Define rollback and compatibility windows for every migration.

## Stage 1 — Tenancy and identity expansion

- Create default Organization/Branch records.
- Add nullable `organizationId`/`branchId` to new/selected records.
- Backfill all existing records to the default tenant in bounded batches.
- Create role assignments mirroring legacy `User.role`; keep legacy reads.
- Validate: every active user has one organization and intended branch/role assignment.

Rollback: continue legacy role reads; new assignments remain unused.

## Stage 2 — Academic structure

- Create AcademicSession, ClassLevel, Subject, Chapter, Batch, Enrollment and TeacherAssignment.
- Map legacy `studentClass`, subject strings/aliases and `teacherDomain` arrays.
- Generate exception reports for unmapped classes/subjects/students; do not guess silently.
- Dual-read teacher scopes, compare decisions in shadow logs, then switch.

Rollback: policy feature flag returns to embedded teacherDomain.

## Stage 3 — Assessment versioning

- Import `PracticeQuestion` and `McqQuestion` into Question/QuestionVersion with legacy IDs.
- Create immutable ExamVersion snapshots for future publishes.
- Keep old attempt/result documents; attach source/version references when safely derivable.
- New attempts store full scoring snapshot. Historical results remain readable from legacy adapters.

Rollback: new publish disabled; old readers stay available. Never rewrite historical scores without an approved correction record.

## Stage 4 — Core operations

- Introduce attendance/CQ/fees as new collections after tenant/batch truth exists.
- Financial migration uses opening balances and immutable source references; validate totals by branch/student/date.

## Validation gates

- Record counts before/after and checksum/aggregate comparisons.
- Required relationship coverage ≥99.9%; all exceptions explicitly resolved.
- Index creation monitored and reversible.
- Dual-read parity dashboards for authorization, rosters and results.
- Staging restore rehearsal using sanitized/authorized data.
- Rollback tested before production switch.

## Data retention

Keep legacy collections read-only for at least one full academic/reporting cycle after cutover, subject to privacy policy. Remove only after approved archival, verified backups and zero legacy reads.
