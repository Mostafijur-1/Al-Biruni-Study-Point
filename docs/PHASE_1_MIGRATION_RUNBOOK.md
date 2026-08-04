# Phase 1 migration runbook

## Migration

ID: `20260804_phase1_additive_assessment_state`

This migration only backfills missing `McqExam.version` and `McqExam.isArchived` defaults. Audit, void, scoring-snapshot, PWA hash, and retention fields are additive and populate on new writes. It does not delete or rewrite attempts, results, questions, subscriptions, or legacy telemetry.

## Approval gate

Do not apply this migration from a developer workstation against production without an approved maintenance window, a fresh database backup, and a named rollback owner.

1. Confirm the application commit containing this runbook is deployed to staging.
2. Take and verify a MongoDB backup/snapshot.
3. Run the dry check: `npm run migrate:phase1`.
4. Review `pendingExams` and the migration ledger status.
5. Run the staging apply command:
   `npm run migrate:phase1 -- --apply --confirm=20260804_phase1_additive_assessment_state`
6. Re-run the dry check; expect `pendingExams: 0` and `ledgerStatus: completed`.
7. Exercise teacher exam list/edit/publish, student start/submit, and result viewing.
8. Repeat in production only after staging acceptance.

## Rollback

The application is compatible with absent additive fields, so rollback is the previous application release. Leave the two harmless backfilled defaults and the migration ledger intact; removing them adds risk without restoring user data. If a data rollback is exceptionally required, restore the verified pre-migration snapshot instead of issuing broad `$unset` operations.

## PWA retention migration note

New install/launch telemetry stores a keyed IP hash, bounded user agent, deduplicated event key, and a 90-day expiry. Existing records with raw `ipAddress` are intentionally not changed by this migration. Their anonymization/deletion requires a separately reviewed retention migration with an exported count, backup, and explicit approval.
