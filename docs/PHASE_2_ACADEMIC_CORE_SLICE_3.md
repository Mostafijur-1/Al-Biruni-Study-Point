# Phase 2 — Academic core, slice 3

## Objective

Establish the verification tools and deterministic rules needed before canonical academic scope and timetable operations can become authoritative.

## Changes completed

- Added half-open time overlap, effective-date overlap, routine collision, and terminal class-session transition rules.
- Added canonical-versus-legacy teacher-scope comparison with subject-alias support.
- Added a read-only scope parity command that reports matches, mismatches, and legacy all-access assignments requiring review.
- Added a destructive-but-isolated database integration harness for batch capacity, transaction rollback, transfer counters, teacher assignments, and audit atomicity.
- Refactored academic workflow imports so the same production service code is exercised by the standalone DB harness.
- Added transaction-safe routine creation and ending with serialized branch schedule writes, teacher ownership enforcement, and historical effective-date collision checks.
- Added transaction-safe class-session creation, completion, and cancellation with timetable/timezone validation and terminal-state protection.
- Added role-scoped routine and class-session APIs for administrators, teachers, and actively enrolled students.

## Teacher-scope parity audit

Run against a reviewed environment:

```powershell
npm.cmd run audit:academic-scope
```

The command writes nothing and emits teacher IDs, assignment counts, and exact canonical-only/legacy-only class, subject, and student differences. Use strict CI/staging mode after mappings are expected to match:

```powershell
npm.cmd run audit:academic-scope -- --fail-on-mismatch
```

`teacherDomain.isAll` always requires explicit review; the audit never assumes that a finite canonical assignment silently replaces global legacy access.

## Database integration harness

The harness intentionally deletes records from the configured test database before and after its run. It refuses the production database name and requires an explicit `absp_*test` name plus transaction-capable MongoDB:

```text
ACADEMIC_TEST_MONGODB_URI=mongodb://localhost:27017
ACADEMIC_TEST_DB_NAME=absp_academic_test
```

Run only against a disposable replica-set database:

```powershell
npm.cmd run test:academic-db
```

It exercises the real services and collections, including a capacity rejection rollback, timetable collision rejection, session-state transition, and audit-count verification. It was added but not executed in this repository session because no approved disposable MongoDB test environment was available.

## Timetable API behavior

- `GET /api/routines` and `GET /api/class-sessions` scope teachers to their own records and students to batches where they have a current active enrollment.
- `POST /api/routines` supports `create` and `end`; `POST /api/class-sessions` supports `create`, `complete`, and `cancel`.
- All timetable mutations require `ACADEMIC_WRITES_ENABLED=true`, use the production transaction/audit workflow, and reject unauthorized teacher ownership.
- Routine-linked sessions must match the organization timezone, weekday, and exact routine start/end minutes.
- Assignment and routine windows cannot be shortened past linked sessions; active routines must be ended before their teacher assignment.

## Remaining Phase 2 operational work

- Run the DB integration harness successfully.
- Run bootstrap dry-run/apply in staging with an approved manifest.
- Resolve parity differences and shadow-read existing teacher policies before switching authority.
- Run authenticated timetable journeys in an attached browser at mobile and desktop widths.

Phase 3 attendance must not begin until roster, assignment, routine, and class-session truth has passed these checks.
