# Step 10 legacy contraction runbook

Step 10 is a contract migration, not ordinary cleanup. The current release is **not eligible**: active code still reads/writes `teacherDomain`, curriculum strings, and duplicate result stores. Legacy embedded written-question bytes are intentionally read-only historical data.

## Required sequence

1. Deploy canonical authority with compatibility readers and deprecated-write telemetry.
2. Observe one 28-day academic/reporting cycle. A shorter complete cycle requires named approval and a written reason.
3. Export aggregate telemetry proving zero deprecated writes and zero unexplained deprecated reads for all four authorities. Do not export user or record samples.
4. Complete the isolated backup-restore rehearsal in `RECOVERY_RUNBOOK.md`.
5. Run full tests, typecheck, lint, build, authenticated admin/teacher/student journeys, accessibility smoke checks, and a rollback drill.
6. Approve retention: keep immutable historical snapshots/audit evidence; keep alias readers only at import boundaries; dispose only data explicitly authorized by policy.
7. Copy the evidence example to `evidence/legacy-contraction.approved.json`, replace every placeholder, bind it to the exact tested commit, and run:

```text
npm run check:legacy-contraction -- --environment=production --database=<database> --evidence=evidence/legacy-contraction.approved.json --strict
```

8. Only an `eligible` report authorizes a separate contraction change. Archive writers before removing fields. Deploy reader removal first, verify, then execute any separately reviewed bounded data cleanup.

## Rollback

Restore the preceding application release to recover compatibility readers. Keep canonical records and immutable history. Do not restore deprecated write authority automatically. If canonical data is damaged, follow the isolated restore process and require incident-owner approval before any production restore.
