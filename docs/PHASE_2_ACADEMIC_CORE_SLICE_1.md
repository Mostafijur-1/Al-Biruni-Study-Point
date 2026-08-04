# Phase 2 — Academic core, slice 1

## Phase objective

Create the canonical academic records that attendance, routines, class operations, assessment eligibility, and future guardian/finance workflows can safely reference.

## Current-state findings

- `/api/batches` and `/api/enrollments` returned `501` placeholders.
- There were no organization, branch, academic-session, batch, enrollment, teacher-assignment, routine, or class-session collections.
- Teacher scope existed only as mutable arrays embedded in `User.teacherDomain`, without effective dates or assignment history.
- Subjects and chapters were stored as repeated strings in feature-specific models and source files.

## Scope completed in this slice

- Added additive tenant and academic hierarchy models: `Organization`, `Branch`, `AcademicSession`, `AcademicSubject`, `AcademicChapter`, and `AcademicTopic`.
- Added operational models: `Batch`, `BatchEnrollment`, `TeacherAssignment`, `RoutineSlot`, and `ClassSession`.
- Added effective dates and history-preserving lifecycle states for enrollments, assignments, routines, batches, and sessions.
- Added active-enrollment and active-assignment uniqueness indexes.
- Replaced the two `501` endpoints with authenticated, bounded, role-scoped read APIs.
- Added pure lifecycle, capacity, effective-date, routine-window, and role-scope rules with unit tests.

## Out of scope

- Admin create/edit/archive workflows for the new hierarchy.
- Student transfer, enrollment, and teacher-assignment mutations.
- Legacy data backfill or guessed mapping from class strings to a branch, session, or batch.
- Attendance sheets and attendance UI.
- Learning-material and recorded-class migration.
- Switching existing exam, practice, and content policies from `teacherDomain` to canonical assignments.

## Affected files and data

All collections are new and additive. Existing users, `teacherDomain`, courses, questions, attempts, results, and content records are unchanged. No migration was run against a database.

Every operational record carries `organizationId`; branch-owned records also carry `branchId`. Enrollment and teacher-assignment records carry `academicSessionId` and effective dates so transfers and ended assignments can remain in history.

## API behavior

### `GET /api/batches`

- Admin: reads bounded batches matching supplied filters.
- Teacher: reads only batches with a current active `TeacherAssignment`.
- Student: reads only batches with a current active `BatchEnrollment`.
- Missing assignment/enrollment defaults to an empty result, never broad access.

### `GET /api/enrollments`

- Admin: reads bounded enrollment records and may filter by student.
- Teacher: reads rosters only for currently assigned batches.
- Student: reads only their own enrollment history matching the requested status.
- Responses expose only the student identifier, name, and class needed for roster display.

Both endpoints use the Phase 1 error envelope, validation codes, and request identifiers.

## Security considerations

- New teacher/student reads are default deny and derive scope from canonical assignments or enrollments.
- Query filters cannot expand a teacher beyond assigned batches or a student beyond their own records.
- Current admins remain global because existing user records have no organization/branch assignment. Tenant-scoped admin roles must be added before multi-organization operation.
- Existing feature routes continue reading `teacherDomain`; canonical dual-read/shadow comparison is a later controlled rollout step, not an implicit permission expansion.

## Migration and rollout

No data migration is required to deploy the additive schemas. The new APIs return empty lists until canonical records exist.

The next rollout slice must provide an admin-only bootstrap and mapping workflow that:

1. creates the approved default organization, branch, and academic session;
2. imports canonical subjects with aliases;
3. creates batches only from confirmed operational rosters;
4. reports ambiguous student and teacher mappings for admin resolution;
5. shadow-compares canonical assignment decisions with `teacherDomain` before any existing feature switches reads;
6. supports rollback by leaving legacy reads intact and never deleting the new history records.

## Test and validation plan

- Unit tests cover lifecycle transitions, invalid date/time windows, capacity boundaries, effective dates, role scopes, deduplication, and default-deny behavior.
- Repository tests, typecheck, lint, and production build must pass before push.
- Database integration tests for partial unique indexes, cross-tenant isolation, and effective-date queries remain required before write APIs are enabled.
- Interactive admin/teacher/student roster QA remains blocked until a browser runtime and seeded canonical dataset are available.

## Known limitations and risks

- Model references cannot by themselves guarantee that organization/branch/session identifiers agree; write services must validate those relationships transactionally.
- Capacity is defined but not yet enforced because enrollment mutation is intentionally absent in this slice.
- Routine collision checks and class-session generation are not yet implemented.
- No new collection is populated automatically; guessing legacy organizational context would create incorrect academic history.

## Recommended next slice

Build the guarded academic bootstrap/import workflow, transactional enrollment/transfer and teacher-assignment services, audit every mutation, and add database integration tests before exposing admin mutation UI.
