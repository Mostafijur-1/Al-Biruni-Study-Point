# Written Exam Hardening

Step 7 makes written results reproducible and correctable without making ABSP a question-file host.

## Question-source decision

- A question source is optional.
- New uploads are disabled at both the UI and application-service boundary.
- Draft exams may reference only `drive.google.com` or `docs.google.com` URLs. The URL can be replaced or removed before publication.
- Every question-source request is authorized in ABSP before redirecting, and the redirect is private/no-store with no referrer.
- Google Drive remains the file authority and applies its own sharing permissions. ABSP stores only the URL and setter metadata.
- Legacy database-embedded question files remain authorized, read-only compatibility data during rollback. No new embedded files are created.

This replaces the original object-storage deliverable because the product owner explicitly chose no question upload, with an optional Drive reference.

## Publication and correction invariants

- A publication transaction freezes the result roster and content hash, creates canonical written assessment attempts, locks the source result rows, updates the exam, and writes the audit record together.
- The unique publication-per-exam key makes publication retries idempotent.
- Published result rows and publication snapshots cannot be updated or deleted through the models.
- Corrections are append-only events with contiguous sequence numbers, before/after state, actor, reason, timestamp, and content hash.
- Student, roster, and report readers replay corrections from the frozen original result.

## Retention and deletion

- Draft Drive links may be replaced or removed; ABSP deletes no Drive content.
- Published question references, publication snapshots, original results, canonical attempts, corrections, and audit records are retained as examination evidence.
- Legacy embedded question bytes are retained read-only until a separately approved, verified cleanup migration exists.
- Orphan cleanup is intentionally not applicable to Drive links because ABSP stores no asset copy and has no authority to delete Drive files.

## Migration and rollback

Run a bounded inspection first:

```text
npm run migrate:written-exams -- --environment=staging --database=<database> --limit=500
```

Apply only after reviewing the report:

```text
npm run migrate:written-exams -- --environment=staging --database=<database> --limit=500 --apply --confirm=step7-written-exam-publication-backfill-v1
```

The migration creates frozen snapshots for legacy published exams and links existing kernel records; it does not rewrite marks. For application rollback, set `WRITTEN_EXAM_KERNEL_WRITES=false`. Existing immutable publications and attempts remain evidence and legacy readers continue to work.
