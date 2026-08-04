# Phase 3 attendance release gate

This gate applies only after the bounded attendance implementation is complete behind a dedicated default-off write flag. It verifies release evidence and produces pilot eligibility; it never changes configuration or unlocks runtime writes.

## Required inputs

- The approved entry artifact created through `PHASE_3_ATTENDANCE_ENTRY_GATE.md`.
- The reviewed Phase 2 rollout evidence that supported that entry authorization.
- A release candidate descended from the artifact's `authorizedBaseCommit`.
- A reviewed evidence artifact based on `phase3-attendance-release-evidence.example.json`.
- A clean Git worktree at the exact `releaseCommit`.

The evidence must cover migration dry-run/apply/rollback, schema and indexes, transaction rollback, authorization scope, idempotency and concurrency, correction audit, calculation policy, outbox replay, privacy/security, authenticated browser and accessibility coverage, observability, and a rollback drill.

## Validation workflow

1. Copy the example to the ignored path `evidence/phase3-attendance-release.approved.json`.
2. Replace every placeholder with reviewed evidence from the exact release candidate.
3. Keep `attendanceWritesDefaultOff` set to `true` throughout validation.
4. Record the named pilot branch and runtime rollout approval only after every other gate passes.
5. On a clean release-candidate worktree, run:

```powershell
npm.cmd run check:attendance-release -- --require-evidence
```

A qualifying report shows:

- `status: "eligible-for-scoped-pilot"`;
- `eligibleForScopedPilot: true`; and
- `attendanceRuntimeUnlocked: false`.

The last value is intentional. The checker is read-only and cannot modify a feature flag, database, deployment, or branch configuration. An authorized operator must apply the separately approved deployment change only to the named pilot branch.

## Rejection rules

The checker blocks when:

- the evidence or entry authorization is missing, invalid, or mismatched;
- the Phase 2 evidence does not match the authorized base or the entry approval predates it;
- the release commit is stale or the worktree is dirty;
- the authorized base is not an ancestor of the release candidate;
- any required gate, browser modality, or accessibility modality is absent;
- validation occurred with attendance writes enabled;
- the rollout approval predates any release gate;
- the initial scope is broader than one named pilot branch; or
- placeholders or unknown authority fields remain.

## Pilot boundary

Pilot eligibility does not approve general production rollout. Expansion requires reviewed pilot metrics, correction samples, support incidents, privacy checks, outbox lag, and rollback readiness. Submitted attendance, corrections, audit history, idempotency records, and outbox events are preserved during rollback.
