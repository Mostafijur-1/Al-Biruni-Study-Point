# ABSP tenancy and canonical index decision

**Decision date:** 30 August 2026

## Tenancy model

ABSP will operate as one organization with one or more branches for the current product horizon. Organization scope remains explicit so records cannot accidentally become global and a future organization boundary does not require rewriting every operational collection.

- `organizationId` is the tenant boundary.
- `branchId` is the operational location boundary where a record belongs to a branch.
- `academicSessionId` is required for session-bound academic operations.
- A user has one home organization initially. Branch access and staff responsibility are represented by scoped role/assignment records, not by cloning user accounts.
- Phone and email remain globally unique during this single-organization phase. Re-scoping identity uniqueness requires a separate identity migration and is not part of Step 2.
- Legacy records may temporarily omit canonical scope, but new operational writes must move toward complete scope in Step 3.

## Batch uniqueness

The legacy batch index enforced `{ branchId, academicSessionId, code }` uniqueness even when all three fields were absent. MongoDB indexes missing values as null-like keys, so the index could block multiple legacy documents or fail during index creation.

The replacement is a named partial unique index. It applies only when branch, academic session, and code have canonical types. This preserves legacy readability while enforcing the intended invariant for canonical batches.

Migration order:

1. Count fully canonical duplicate groups without emitting their values.
2. Block if any duplicate group exists.
3. Create `uq_batch_scope_code_canonical`.
4. Verify the new index.
5. Drop `branchId_1_academicSessionId_1_code_1`.
6. Record completion in `migrationrecords`.

The default command is a dry run:

```powershell
npm.cmd run migrate:scope-indexes -- --environment=staging --database=absp_staging
```

Apply requires the same explicit database target and the exact confirmation token printed by the dry run. Production application is prohibited until backup/restore evidence and the reviewed staging dry-run/apply reports exist.

Rollback does not remove the partial unique index because it protects canonical data without rejecting incomplete legacy rows. A compatibility non-unique query index may be added later only if measured query plans require it.
