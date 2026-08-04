# Phase 3 attendance entry contract

Status: design complete; runtime implementation locked.

This contract defines the first Phase 3 attendance slice without creating attendance collections, routes, feature flags, navigation, or write authority. Implementation may begin only after the Phase 2 evidence in `PHASE_2_COMPLETION_GATE.md` is valid for the implementation commit and Phase 3 is explicitly authorized.

## Entry conditions

All conditions are mandatory:

1. The approved academic bootstrap has passed dry-run and apply review in staging.
2. The transaction-capable academic database harness has passed and its log has been reviewed.
3. Canonical-versus-legacy teacher scope parity and shadow reads have passed or have reviewed exceptions.
4. Authenticated admin and teacher timetable journeys have passed at mobile and desktop widths, including keyboard and screen-reader smoke checks.
5. `npm.cmd run check:academic-readiness -- --strict --require-evidence` passes on the exact implementation commit.
6. An authorized reviewer explicitly approves Phase 3 and the initial attendance write rollout.

Passing these conditions grants implementation eligibility only. Attendance writes remain disabled until their own guarded rollout is approved.

## First-slice boundaries

The first slice supports one attendance sheet per canonical class session, assigned-teacher/admin marking, idempotent submission, append-only correction, and student self-view. It does not add guardian access, assistant-teacher roles, notification delivery, offline mutation queues, biometric capture, payroll coupling, or automated disciplinary action.

The application currently has only `admin`, `teacher`, and `student` roles. Broader roles in the target permission matrix must not be simulated by weakening those three roles. They require a separately reviewed role migration.

## Authoritative records

### AttendanceSheet

An attendance sheet is the authoritative class-level aggregate.

Required fields:

- `organizationId`, `branchId`, `academicSessionId`, `batchId`, and `classSessionId`.
- `routineSlotId`, `subjectId`, and `teacherAssignmentId` snapshots for reproducibility.
- `status`: `draft` or `submitted`.
- `rosterVersion`, `rosterHash`, and the class-time roster snapshot timestamp.
- `policySnapshot`: the attendance calculation policy and low-attendance threshold effective when the sheet opened.
- `version` for optimistic concurrency.
- `openedBy`, `openedAt`, `submittedBy`, and `submittedAt`.
- `createdAt` and `updatedAt`.

Invariants:

- A unique index on `classSessionId` permits exactly one authoritative sheet.
- A sheet can open only for a canonical class session in the actor's organization and branch scope.
- A submitted sheet is immutable. It is never reopened, overwritten, or hard-deleted.
- Cancelling or rescheduling a class session does not silently delete its attendance history.

### AttendanceRecord

One record exists for every enrollment in the sheet's frozen roster.

Required fields:

- `sheetId`, `enrollmentId`, and `studentId`.
- Student display-name and roll-number snapshots needed to explain the historical roster.
- `status`: `present`, `absent`, `late`, or `excused`.
- Optional non-negative `minutesLate` only when status is `late`.
- Optional private staff note with bounded length and audit classification.
- `markedBy`, `markedAt`, and `version`.

Invariants:

- A unique index on `{ sheetId, enrollmentId }` prevents duplicates.
- Opening a sheet creates unmarked roster rows; it does not infer absence.
- Bulk “সবাই উপস্থিত” is an explicit write and remains reviewable before submission.
- Submission fails while any roster row is unmarked.
- Arbitrary students cannot be inserted into a sheet. Enrollment corrections happen in the academic domain and require a reviewed attendance correction when history is affected.

### AttendanceCorrection

Corrections are append-only records applied to a submitted sheet.

Required fields:

- `organizationId`, `branchId`, `sheetId`, `recordId`, and monotonic `sequence`.
- Complete before/after attendance values.
- A required bounded reason.
- `status`: `pending`, `approved`, or `rejected`.
- `requestedBy` and `requestedAt`, plus reviewer identity, review time, and review reason after a decision.
- `requestId` and audit correlation ID.

Rules:

- Teachers may request a correction only for a class session they were assigned to teach.
- Admin approval applies the correction transactionally; a requester cannot approve their own request in the first slice.
- The original record and every prior correction remain readable to authorized auditors.
- Effective attendance is the original submitted value plus the latest approved correction sequence; rejected and pending requests never affect calculations.
- A duplicate approved correction request returns the original result; it does not append twice.

Low-attendance alerts are derived projections, not attendance authority. They can be rebuilt from submitted sheets and approved corrections.

## Roster and session truth

The roster snapshot is derived from effective-dated active batch enrollments at the class session's scheduled start. A student transferred or withdrawn after that time remains in the historical snapshot. A student enrolled after that time is not silently added.

The server computes a deterministic `rosterHash` from sorted enrollment IDs and effective dates. A client never supplies authoritative roster membership. If the roster changes while a draft is open, the server returns a conflict with the old and new roster versions; an authorized actor must refresh explicitly before marking continues.

Attendance can be submitted only while the class session is eligible for attendance under an explicit server policy. Cancelled sessions reject submission. A schedule edit that changes identity-relevant fields after a draft opened creates a conflict rather than rewriting the sheet.

## State and concurrency contract

```text
canonical class session
        |
        v
      draft -- submit --> submitted -- approved correction --> submitted + correction history
        |
        +-- explicit roster refresh while still unmarked/reviewable
```

- Every draft mutation requires the last-seen sheet `version`.
- A stale version returns `409 ATTENDANCE_VERSION_CONFLICT` with safe refresh metadata.
- Two tabs cannot silently overwrite one another.
- Submit and correction approval use a MongoDB transaction covering records, sheet state, audit log, idempotency result, and outbox event.
- Transaction failure leaves no partial submission, correction, notification event, or projection update.

## Workflow API contract

The implementation should preserve the Phase 0 workflow shape while binding it to a class session:

| Method and path | Purpose | Required authority |
|---|---|---|
| `POST /api/v2/batches/{batchId}/attendance-sheets` | Open or return the sheet for `classSessionId` | Admin in scope or assigned teacher |
| `GET /api/v2/attendance-sheets/{sheetId}` | Read roster, current marks, state, and allowed actions | Admin in scope or assigned teacher |
| `PATCH /api/v2/attendance-sheets/{sheetId}/records` | Apply bounded individual/bulk draft changes | Admin in scope or assigned teacher |
| `POST /api/v2/attendance-sheets/{sheetId}/submit` | Validate and finalize the complete sheet | Admin in scope or assigned teacher |
| `POST /api/v2/attendance-sheets/{sheetId}/corrections` | Request a correction | Admin in scope or assigned teacher |
| `POST /api/v2/attendance-corrections/{correctionId}/approve` | Apply a correction | Admin in scope, not its teacher requester |
| `GET /api/v2/students/me/attendance` | Read the authenticated student's submitted attendance | Student own record only |

Opening is naturally idempotent through the unique class-session key. Every mutation also requires `Idempotency-Key` and a canonical payload hash:

- Repeating the same key and payload returns the original status and response.
- Reusing a key with a different payload returns `409 IDEMPOTENCY_KEY_REUSED`.
- Idempotency scope includes organization, actor, workflow, and target resource.
- Keys and results have a documented retention window longer than the client retry window.

Stable domain errors include `ATTENDANCE_NOT_ELIGIBLE`, `ATTENDANCE_ROSTER_CHANGED`, `ATTENDANCE_UNMARKED_STUDENTS`, `ATTENDANCE_ALREADY_SUBMITTED`, `ATTENDANCE_VERSION_CONFLICT`, `ATTENDANCE_CORRECTION_FORBIDDEN`, and `IDEMPOTENCY_KEY_REUSED`. Safe Bangla messages must not leak other branches, students, staff notes, or resource existence outside scope.

## Authorization and privacy

- Admin access is constrained by organization and branch even if the current legacy admin role is broad.
- Teacher write access requires an effective teacher assignment that matches the sheet's class session, batch, and subject.
- Student reads are server-filtered to the authenticated `studentId`, submitted sheets, and student-safe fields.
- Students never receive staff notes, correction reasons, other roster members, internal actor IDs, or audit details.
- Listing endpoints apply scope in the database query, not after loading results.
- Unauthorized and cross-tenant identifiers use the existing non-enumerating response policy.
- Every open, draft write, submit, correction request, correction approval, export, and sensitive read is correlated with request and audit IDs.

## Calculation policy

The initial default policy is frozen into each sheet:

- `present` and `late` count as attended.
- `absent` counts in the denominator and not the numerator.
- `excused` is excluded from both numerator and denominator.
- If the denominator is zero, the percentage is unavailable rather than `0%` or `100%`.
- Percentages are derived from integer counts and rounded only for display.

Organization-specific policy can be added later only as validated configuration with an effective date. Historical sheets retain their policy snapshot. Low-attendance alerts run after submission or approved correction, carry the source sheet IDs, and never mutate source records.

## Mobile and accessibility contract

The teacher's primary flow is: select today's class, open roster, use explicit bulk-present if appropriate, change exceptions, review counts, and submit once.

- The default mobile view fits one-hand marking and keeps status controls at least 44 by 44 pixels.
- Status is conveyed by text and icon, never color alone.
- Each student row exposes one labelled status group with predictable keyboard order.
- Bulk action announces the number of affected rows and remains reversible while draft.
- Submit shows marked counts, unmarked count, class identity, and a clear irreversible-state warning.
- Network retry reuses the same idempotency key and visibly distinguishes pending, failed, and confirmed states.
- The first slice does not promise offline writes. A disconnected client preserves only non-sensitive interface state and requires reconfirmation after refresh.
- Screen-reader output announces student identity, current status, validation errors, roster conflicts, and successful submission without relying on toast messages alone.
- Reduced-motion, visible focus, zoom/reflow, Bangla text expansion, and desktop keyboard operation are release requirements.

## Events and later consumers

Successful submission emits one transactional outbox event containing identifiers and aggregate counts, not private notes. Approved correction emits a new event referencing the correction sequence. Notification, guardian, reporting, and analytics consumers must be replay-safe and must not delay the authoritative transaction.

Guardian delivery belongs to Phase 7. Phase 3 may prove that correct outbox events exist, but it must not expose guardian data or create an unverified guardian link to satisfy a notification requirement early.

## Rollout and observability

The implementation must introduce a dedicated attendance-write flag that defaults to false and is separate from `ACADEMIC_WRITES_ENABLED`. Reads and writes must fail closed when prerequisites are absent.

Initial rollout is limited to an approved staging branch, then a named pilot branch. Required metrics include open/mark/submit latency, version conflicts, roster conflicts, submission retries, idempotent replays, correction rate, transaction failures, and outbox lag. Metrics must not contain names, notes, phone numbers, or raw student IDs.

Rollback disables new writes and consumers while preserving submitted sheets, corrections, audits, idempotency records, and outbox history. Rollback never deletes attendance history.

## Implementation sequence after authorization

1. Add schemas, indexes, migrations, pure policy functions, and default-off configuration.
2. Add scoped read/open/draft services and database integration tests.
3. Add idempotent transactional submit, correction, audit, and outbox workflows.
4. Add teacher mobile UI and admin review UI behind the flag.
5. Add student-own submitted view and derived batch/student summaries.
6. Complete authenticated mobile, desktop, keyboard, and screen-reader evidence.
7. Run a bounded pilot and record approval before expanding attendance writes.

No step may bypass the Phase 2 entry conditions or turn a passing test suite into rollout authority.
