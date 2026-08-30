# Canonical academic authority runbook

Step 3 adds canonical IDs without removing legacy labels. Legacy subject/chapter text remains display and compatibility data; it is not accepted as authority after cutover.

## Safety model

- `CANONICAL_ACADEMIC_AUTHORITY_ENABLED=false` preserves legacy authorization and permits compatibility writes while backfill runs.
- `CANONICAL_ACADEMIC_SHADOW_READS_ENABLED=true` evaluates both teacher policies but continues enforcing the legacy result.
- `CANONICAL_ACADEMIC_AUTHORITY_ENABLED=true` makes `TeacherAssignment` and canonical IDs authoritative. Missing canonical scope fails closed.
- Subject aliases are used only to validate an explicit canonical ID or by the migration tool. Ambiguous aliases are exceptions, never guesses.

## 1. Dry-run the bounded backfill

Run against staging first and use its explicit database name:

```powershell
npm.cmd run migrate:canonical-scope -- --environment=staging --database=<staging-db> --limit=500
```

Review every hashed exception reference. Correct the canonical catalog or document mapping and repeat until all active operational records are planned or appear in an approved exception register.

## 2. Apply one bounded batch

```powershell
npm.cmd run migrate:canonical-scope -- --environment=staging --database=<staging-db> --limit=500 --apply --confirm=step3-canonical-academic-scope-v1
```

Repeat dry-run/apply batches. The migration only sets canonical fields and records a migration summary. Rollback is the feature flag; canonical fields should be retained.

## 3. Collect exact-commit authorization evidence

Enable shadow reads in staging, exercise teacher content workflows, then run:

```powershell
npm.cmd run audit:academic-scope -- --commit=<deployed-git-sha> --fail-on-mismatch
```

Default output contains aggregate counts and no user IDs. Add `--details` only in an access-controlled operator session; references remain hashed. The reviewed evidence must name the exact deployed commit and show no unresolved canonical expansion.

## 4. Cut over

Only after the backfill and parity evidence are approved:

1. Set `CANONICAL_ACADEMIC_AUTHORITY_ENABLED=true` in staging.
2. Verify course, video, CQ, written-exam, and student-report writes plus assigned/unassigned teacher cases.
3. Repeat the evidence check for the production candidate commit.
4. Enable production authority and monitor authorization denials and canonical validation failures.

To roll back enforcement, set `CANONICAL_ACADEMIC_AUTHORITY_ENABLED=false`. Do not delete canonical records or IDs.
