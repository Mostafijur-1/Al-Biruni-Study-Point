# Phase 2 — Academic core, slice 2

## Phase objective

Add guarded creation and history-preserving workflow primitives for the canonical academic core without enabling unverified production writes.

## Changes completed

- Added an explicit, manifest-driven organization/branch/session/subject bootstrap.
- Added transactional batch creation, student enrollment, student transfer, teacher assignment, and assignment-ending services.
- Added admin-only mutation contracts to `POST /api/batches`, `POST /api/enrollments`, and `POST /api/teacher-assignments`.
- Added admin/teacher scoped reads at `GET /api/teacher-assignments`.
- Extended audit writing so the academic mutation and its `AuditLog` record share the same MongoDB transaction.
- Added an atomic `activeEnrollmentCount` reservation to prevent concurrent requests from overfilling a batch.
- Added safe duplicate-key handling to the common API error boundary.
- Added `ACADEMIC_WRITES_ENABLED`, which defaults closed unless explicitly set to `true`.

## Bootstrap workflow

Copy [phase2-academic-bootstrap.example.json](./phase2-academic-bootstrap.example.json), replace every placeholder, add the complete approved subject list, and review dates and names.

Dry run:

```powershell
npm.cmd run bootstrap:academic -- --manifest=docs/phase2-academic-bootstrap.approved.json
```

The report shows existing canonical records plus the number of active students and legacy-scoped teachers that still require deliberate mapping. Dry run writes nothing.

Apply only after backup and manifest approval:

```powershell
npm.cmd run bootstrap:academic -- --manifest=docs/phase2-academic-bootstrap.approved.json --apply --confirm=20260905_single_organization_academic_bootstrap_v2
```

Apply is transaction-backed, ledgered in `MigrationRecord`, refuses paths outside the workspace, rejects manifest placeholders/duplicate subject codes/inverted dates, and does not create guessed batches, enrollments, or teacher assignments.

## Mutation contracts

- `POST /api/batches` creates a planned batch only when organization, branch, session, and dates agree.
- `POST /api/enrollments` accepts explicit `enroll` or `transfer` actions with a reason.
- Enrollment requires an active student whose class matches the batch.
- A student can have only one active enrollment per organization and academic session.
- Transfer preserves the old enrollment as `transferred` and creates a new active enrollment in the same transaction.
- `POST /api/teacher-assignments` accepts explicit `assign` or `end` actions with a reason.
- Assignment requires an approved active teacher and a canonical subject valid for the batch class.
- All mutations are admin-only, validated, audited, and transaction-backed.

## Security and rollout gate

The mutation routes return `503 SERVICE_UNAVAILABLE` unless the server has:

```text
ACADEMIC_WRITES_ENABLED=true
```

Keep this false until all of the following are complete:

1. reviewed bootstrap dry run;
2. database backup and approved apply;
3. MongoDB replica-set transaction support confirmed;
4. database integration tests for uniqueness, capacity concurrency, rollback, and cross-scope access;
5. admin/teacher/student QA against a seeded non-production dataset.

Read endpoints remain assignment/enrollment scoped regardless of the feature flag.

## Data and rollback

All changes are additive. The bootstrap does not modify users or `teacherDomain`. Workflow history and audit records must not be deleted during rollback.

Rollback procedure:

1. set `ACADEMIC_WRITES_ENABLED=false`;
2. deploy the prior code if required;
3. retain canonical and audit collections for investigation;
4. continue legacy feature reads until canonical parity has been verified.

## Tests and limitations

Unit/contract coverage includes manifest validation and path containment, feature-gate behavior, batch/enrollment/assignment contracts, lifecycle rules, capacity boundaries, and API error primitives.

Database transactions and partial indexes are not exercised by the repository's current unit-test harness. The bootstrap was not run and no database data was changed in this slice. Existing content/exam/practice routes still use `teacherDomain`; switching those reads requires a later shadow-comparison rollout.

## Recommended next slice

Add a disposable MongoDB integration-test environment, execute the approved bootstrap against staging, build canonical-versus-legacy teacher-scope shadow reports, then add routine conflict detection and class-session generation before Phase 3 attendance begins.
