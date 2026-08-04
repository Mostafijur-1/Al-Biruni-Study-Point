# Phase 2 completion gate

## Code status

The academic-core code slice is complete. It now contains canonical organization, branch, session, curriculum, batch, enrollment, teacher-assignment, routine, and class-session models; guarded transactional write services; scoped read/write APIs; responsive administrator/teacher timetable workspaces; deterministic collision and lifecycle rules; audit logging; bootstrap tooling; parity tooling; and an isolated database integration harness.

`ACADEMIC_WRITES_ENABLED` remains disabled by default. Phase 2 is code-complete but is not operationally approved until every gate below passes in an approved non-production environment.

Run the read-only prerequisite report at any time; it never connects to MongoDB:

```powershell
npm.cmd run check:academic-readiness
```

Use `npm.cmd run check:academic-readiness -- --strict` in CI when missing prerequisites should fail the job. A successful prerequisite report only permits the external validation work below; it never enables Phase 3 automatically.

After every external gate passes on the same commit, copy `docs/phase2-rollout-evidence.example.json` to the ignored local/CI artifact path `evidence/phase2-rollout-evidence.approved.json`, replace every placeholder, and have each reference reviewed. Then run:

```powershell
npm.cmd run check:academic-readiness -- --strict --require-evidence
```

Evidence is rejected if incomplete, still contains placeholders, lacks any browser modality, or names a commit other than the current `HEAD`. A valid report means only that the code is eligible for explicit Phase 3 authorization; it does not change a feature flag or unlock attendance.

## Required operational gates

- Review and approve a real bootstrap manifest derived from `docs/phase2-academic-bootstrap.example.json`.
- Run `npm.cmd run bootstrap:academic -- --manifest <approved-manifest> --dry-run` against staging and review the report.
- Apply the approved manifest in staging and verify its migration-ledger record.
- Run `npm.cmd run test:academic-db` against a disposable transaction-capable MongoDB database named `absp_*test`.
- Alternatively, run `npm.cmd run test:academic-db:memory` to create a loopback-only temporary replica set and execute the same production-service harness. Its first run downloads an official MongoDB test binary unless `MONGOMS_SYSTEM_BINARY` points to an installed compatible binary; cache the large Windows archive in CI.
- Run `npm.cmd run audit:academic-scope -- --fail-on-mismatch` and resolve every mismatch or explicitly reviewed global legacy assignment.
- Shadow-read canonical teacher scope against legacy authorization before changing authority.
- Run authenticated administrator/teacher timetable journeys in an attached browser at mobile and desktop widths, including keyboard and screen-reader smoke checks.
- Obtain an explicit rollout decision before enabling `ACADEMIC_WRITES_ENABLED=true` outside the approved validation environment.
- Record the reviewed results and academic-write rollout approval in the bounded evidence artifact.

## Phase 3 boundary

Do not enable attendance capture or migrate attendance authority until roster, assignment, routine, and class-session truth passes these gates. No bootstrap, migration, parity audit, integration cleanup, or database mutation was run while completing this code slice because no approved staging manifest or disposable database was supplied.
