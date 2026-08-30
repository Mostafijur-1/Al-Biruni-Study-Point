# Architecture readiness baseline runbook

The architecture readiness command is a read-only prerequisite for schema remediation. It reports deployment classification, write-gate safety, MongoDB topology capability, collection counts and index names, missing canonical scope, orphan counts, duplicate-group counts, and legacy-versus-canonical usage.

It never prints connection strings, database hosts, document samples, duplicate keys, or student identifiers. It does not import Mongoose models and connects with automatic index creation disabled.

## Command

```powershell
npm.cmd run check:architecture-readiness -- --environment=development
```

Use `--strict` in CI and release review. Strict mode exits unsuccessfully when any blocker exists:

```powershell
npm.cmd run check:architecture-readiness -- --environment=staging --strict
```

Use `--skip-database` only to test configuration/evidence handling without connecting to MongoDB:

```powershell
npm.cmd run check:architecture-readiness -- --environment=test --skip-database --strict
```

The command always exits unsuccessfully when a write gate is enabled without valid commit-bound evidence, even without `--strict`.

## Environment safety

### Development

1. Set `ACADEMIC_WRITES_ENABLED=false` and `ATTENDANCE_WRITES_ENABLED=false` unless testing an explicitly approved rollout commit.
2. Point `MONGODB_URI` to the intended read target.
3. Run with `--environment=development`.
4. Treat production-derived counts as sensitive operational metadata even though no record samples are emitted.

### Staging

1. Confirm the staging database and a least-privilege read credential.
2. Run from a clean checkout of the exact candidate commit.
3. Supply reviewed evidence through the default ignored paths or explicit arguments:
   - `--academic-evidence=evidence/phase2-rollout-evidence.approved.json`
   - `--attendance-authorization=evidence/phase3-attendance-authorization.approved.json`
   - `--attendance-evidence=evidence/phase3-attendance-release.approved.json`
4. Capture the JSON output in the approved evidence system; do not commit environment reports.

### Production

1. Use a dedicated least-privilege database user that can run `hello`, `listCollections`, `listIndexes`, counts, and read-only aggregations.
2. Run from a clean checkout of the deployed commit with `--environment=production --strict`.
3. Never substitute a production URI into `ACADEMIC_TEST_MONGODB_URI`.
4. Do not proceed with migration work while the report status is `blocked`.

## Interpreting results

- `writeGates.status=blocked`: disable the named gate or supply evidence valid for the exact clean commit.
- `database.status=unavailable`: verify URI configuration, allow-list/network policy, and read permissions. The report intentionally suppresses the provider error.
- `topology.transactionCapable=false`: do not run transactional migrations or workflows on that topology.
- `missingScope`: counts documents missing each canonical field; it does not expose document IDs.
- `orphans`: counts references whose target does not exist.
- `duplicates`: reports only duplicate-group and affected-document counts; it never emits duplicate values.
- `legacyVsCanonical`: establishes the baseline for later backfill and shadow-read work.

This command does not create evidence approval, enable a feature flag, modify an index, repair an orphan, or perform a migration.
