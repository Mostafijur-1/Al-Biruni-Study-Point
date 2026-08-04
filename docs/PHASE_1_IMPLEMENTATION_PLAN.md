# Phase 1 — Foundation and P0 stabilization

## Objective

Close the confirmed authorization, academic-record integrity, scoring, and notification-trigger risks without destructive migration or expansion into new product modules.

## Current findings addressed by this slice

- Teachers can read formal MCQ results for exams owned by another teacher.
- Result and exam APIs can hard-delete academic history.
- Published exam totals can differ from the sum of question marks.
- Exam content remains editable around publication without a frozen scoring baseline.
- The evening reminder accepts unauthenticated requests when `CRON_SECRET` is absent.
- Teachers can send broadcasts beyond their assigned students.

## In scope

- Default-deny resource ownership policy for formal exam result reads and mutations.
- Audited void operations for formal and practice attempts.
- Audited exam archive operation; removal of ordinary hard-delete paths.
- Additive audit and immutable-state metadata.
- Publish-time exam validation and server-derived scoring totals.
- Production-safe cron authentication and admin-only broadcast.
- Unit tests for policy and exam invariants plus existing regression suites.

## Out of scope

- Organization/branch and the full assignment schema.
- Attendance, finance, guardian, admissions, and CQ implementation.
- Full ExamVersion/QuestionVersion migration of already-running exams.
- Navigation redesign, broad translation work, and optional feature expansion.

## Expected files and data changes

- New policy, audit, and exam-invariant helpers under `lib/`.
- New additive `AuditLog` model.
- Additive void/archive/publication snapshot fields on existing models.
- Existing result, exam, cron, and broadcast route updates.
- Teacher result/exam UI actions changed from delete to reasoned void/archive.
- No existing record is deleted or rewritten by migration in this slice.

## API behavior

- Cross-teacher exam/result access returns a denial without exposing the resource.
- Existing result `DELETE` and exam `DELETE` operations return `405`.
- `POST .../void` records actor, time, reason, request ID, and before/after state.
- `POST .../archive` archives an exam and records the action.
- Publishing validates question marks and pass marks before state changes.
- Cron accepts `POST` only and requires a configured bearer secret.
- Broadcast is admin-only until teacher-assignment recipient scoping exists.

## Security and rollback

- Changes are additive and default deny.
- Rollback is a code rollback; new fields and audit records can remain safely.
- No rollback procedure may delete audit records or previously stored attempts.

## Test plan and acceptance criteria

- Policy tests cover admin, owner teacher, non-owner teacher, and student decisions.
- Invariant tests cover empty exams, invalid marks, total mismatch, and pass-mark bounds.
- Route code has no ordinary hard-delete call for exam attempts, practice attempts, or exams.
- Existing tests, typecheck, lint, and production build pass.
- Interactive role, mobile, keyboard, and screen-reader checks remain required before declaring all of Phase 1 complete.
