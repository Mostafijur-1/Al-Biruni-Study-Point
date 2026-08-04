# Phase 2 completion gate

## Code status

The academic-core code slice is complete. It now contains canonical organization, branch, session, curriculum, batch, enrollment, teacher-assignment, routine, and class-session models; guarded transactional write services; scoped read/write APIs; responsive administrator/teacher timetable workspaces; deterministic collision and lifecycle rules; audit logging; bootstrap tooling; parity tooling; and an isolated database integration harness.

`ACADEMIC_WRITES_ENABLED` remains disabled by default. Phase 2 is code-complete but is not operationally approved until every gate below passes in an approved non-production environment.

Run the read-only prerequisite report at any time; it never connects to MongoDB:

```powershell
npm.cmd run check:academic-readiness
```

Use `npm.cmd run check:academic-readiness -- --strict` in CI when missing prerequisites should fail the job. A successful prerequisite report only permits the external validation work below; it never enables Phase 3 automatically.

## Required operational gates

- Review and approve a real bootstrap manifest derived from `docs/phase2-academic-bootstrap.example.json`.
- Run `npm.cmd run bootstrap:academic -- --manifest <approved-manifest> --dry-run` against staging and review the report.
- Apply the approved manifest in staging and verify its migration-ledger record.
- Run `npm.cmd run test:academic-db` against a disposable transaction-capable MongoDB database named `absp_*test`.
- Run `npm.cmd run audit:academic-scope -- --fail-on-mismatch` and resolve every mismatch or explicitly reviewed global legacy assignment.
- Shadow-read canonical teacher scope against legacy authorization before changing authority.
- Run authenticated administrator/teacher timetable journeys in an attached browser at mobile and desktop widths, including keyboard and screen-reader smoke checks.
- Obtain an explicit rollout decision before enabling `ACADEMIC_WRITES_ENABLED=true` outside the approved validation environment.

## Phase 3 boundary

Do not enable attendance capture or migrate attendance authority until roster, assignment, routine, and class-session truth passes these gates. No bootstrap, migration, parity audit, integration cleanup, or database mutation was run while completing this code slice because no approved staging manifest or disposable database was supplied.
