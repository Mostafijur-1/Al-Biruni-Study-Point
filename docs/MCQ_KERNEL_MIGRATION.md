# Practice and Formal MCQ Kernel Migration

## Runtime behavior

Formal MCQ publication now materializes canonically scoped legacy exams and questions into immutable `AssessmentVersion` and `QuestionVersion` records. Practice start does the same for the selected question set. Legacy records receive optional kernel references, and attempt sessions pin the exact assessment and question versions used.

Rows without complete canonical organization/subject scope remain on the legacy path. This is intentional compatibility behavior: migration never invents curriculum IDs or blocks existing historical readers.

Submission is retry-safe. A canonically pinned session creates one `AssessmentAttempt`, keyed by the attempt-session legacy identity. The existing `McqExamAttempt` or `PracticeAttempt` remains as a compatibility record and references the authoritative kernel attempt. Existing sessions without kernel references continue to submit through the legacy path.

Attempt-session answer drafts support optimistic revisions through `PUT` on the existing practice and formal start endpoints. A stale revision returns `409`; duplicate, unknown, fractional, and out-of-range responses are rejected.

## Result authority and publication

`PracticeAttempt` remains the compatibility authority consumed by current gamification and teacher views, while canonical sessions additionally pin the immutable `AssessmentAttempt`. `PracticeResult` is now explicitly a rebuildable projection linked through `authoritativeAttempt`; new submissions derive it from the saved attempt rather than writing a second independent result payload.

Formal result publication remains an explicit audited teacher action. Comment and void flows remain explicit; voiding is mirrored to the canonical attempt when present. Legacy records remain readable when a canonical reference is absent.

## Safe backfill

The reference migration only links records that already have an unambiguous legacy identity. It does not recalculate or modify marks, percentages, pass state, answers, or timestamps.

Dry run:

```text
npm run migrate:assessment-references -- --environment=staging --database=<name> --limit=500
```

Apply after reviewing counts:

```text
npm run migrate:assessment-references -- --environment=staging --database=<name> --limit=500 --apply --confirm=step6-assessment-reference-backfill-v1
```

Rebuild a bounded batch of practice projections:

```text
npm run rebuild:practice-results -- --database=<name> --limit=500 --apply
```

## Rollback

Set `ASSESSMENT_KERNEL_WRITES=false` to disable kernel materialization for new starts/publications while keeping the legacy attempt readers and writers enabled. Kernel IDs are additive, and legacy attempts/results are retained, so rollback does not require deleting canonical records or rewriting historical scores.
