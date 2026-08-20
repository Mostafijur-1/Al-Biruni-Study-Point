# Coaching enrollment architecture migration

## Domain boundary

Website registration remains a platform account and does not create a coaching enrollment. `BatchEnrollment` is the explicit admin-created coaching relationship. `CoachingEnrollmentSubject` is its effective-dated subject scope; it is never used to remove general MCQ, exam, course, lab, or practice access.

Routine and attendance eligibility now use the same normalized rule:

`active/effective batch enrollment + effective coaching subject = eligible class member`

New routines store `batchId` and `subjectId`; they do not copy student IDs. Submitted attendance retains `AttendanceRecord` rows and student-name snapshots, so a later transfer or subject drop cannot erase history.

## Pricing source

`CoachingBatchSubject.monthlyFeeTk` and `Batch.fullPackageFeeTk` are the operational source of truth. Enrollment changes calculate `BatchEnrollment.monthlyFeeTk` and synchronize the existing `PaymentProfile`; already-created `MonthlyPayment` records are not rewritten.

The migration recognizes only exact HSC 2028 Physics, Chemistry, Higher Math, and ICT definitions. It uses the published subject fees (1300, 1300, 1500, 1000) and preserves the former finance default/published conditional offer of 3500 for the all-subject package. Because that offer says conditions apply, an operator must review it in **Admin → ব্যাচ ও ফি** before applying in production. No price is inferred for other batches.

## Safe rollout

1. Back up MongoDB and run `npm run migrate:coaching` (dry-run).
2. Resolve every reported missing/ambiguous subject or batch.
3. Review the HSC 2028 package fee and configure future batches in the admin UI.
4. Run staging tests with transactions enabled.
5. Run `npm run migrate:coaching -- --apply --actor=<active-admin-object-id>` once.
6. Keep legacy `RoutineSlot.studentIds` data. It remains readable for old records and is not deleted by this migration.
7. Enable `ACADEMIC_WRITES_ENABLED` only after academic readiness approval. Enable `ATTENDANCE_WRITES_ENABLED` separately only after attendance release approval.

The migration is additive and idempotency-guarded by `MigrationRecord`. It never deletes registrations, payments, attendance, routines, or participant lists.
