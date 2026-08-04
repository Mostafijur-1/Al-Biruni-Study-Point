# Phase 3 attendance entry gate

This gate records the explicit authorization required after all Phase 2 operational evidence passes. It authorizes only implementation of the bounded first attendance slice. It does not authorize attendance runtime writes, a pilot, production use, guardian access, or later phases.

## Approval workflow

1. Complete every operational gate in `PHASE_2_COMPLETION_GATE.md` on one base commit.
2. Validate the reviewed Phase 2 evidence on that commit:

```powershell
npm.cmd run check:academic-readiness -- --strict --require-evidence
```

3. Review `PHASE_3_ATTENDANCE_ENTRY_CONTRACT.md` and `PHASE_3_ATTENDANCE_ACCEPTANCE_MATRIX.md` with academic operations, security, and engineering ownership.
4. Copy `phase3-attendance-authorization.example.json` to the ignored path `evidence/phase3-attendance-authorization.approved.json`.
5. Replace every placeholder. Set `authorizedBaseCommit` to the same commit covered by the valid Phase 2 evidence and keep `runtimeWriteRolloutApproved` set to `false`.
6. Record a real approval/change reference, then run:

```powershell
npm.cmd run check:academic-readiness -- --strict --require-evidence --require-phase3-authorization
```

The report must show `phase3ImplementationAuthorized: true` and `phase3Unlocked: false`. The first value permits bounded implementation from the approved base; the second confirms that attendance runtime writes still require their own implementation evidence and rollout approval.

## Rejection rules

Authorization is invalid when it:

- contains placeholders or unknown fields;
- names another or stale base commit;
- is checked against a dirty or unverifiable Git worktree;
- is not backed by valid Phase 2 evidence for the same current commit;
- predates the final recorded Phase 2 evidence gate;
- changes the exact `phase3-attendance-first-slice` scope;
- claims to approve runtime writes;
- is stored outside the workspace; or
- lacks the approver, timestamp, evidence reference, or change reference.

The approved artifact stays outside Git because it contains environment-specific reviewer and change-control details. The schema, example, tests, and checker remain versioned.

## After implementation begins

Phase 3 commits will naturally differ from the authorized base. That does not authorize their rollout. Attendance models, services, APIs, and UI must remain behind a dedicated default-off write flag until the acceptance matrix is satisfied on the exact release candidate and a separate runtime rollout decision is recorded.
