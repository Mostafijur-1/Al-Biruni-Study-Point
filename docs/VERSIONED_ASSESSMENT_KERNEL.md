# Versioned Assessment Kernel

## Purpose

Step 5 introduces a canonical, additive assessment data model without removing the existing MCQ, practice, or written-exam collections. New workflows can adopt the kernel incrementally while legacy readers continue to operate.

## Aggregate model

- `Question` owns curriculum scope, language, provenance, review state, ownership, and optional legacy identity.
- `QuestionVersion` owns immutable prompt, option, answer, explanation, difficulty, marks, and content-hash data.
- `Assessment` owns organization, curriculum, audience, type, ownership, lifecycle, and optional legacy identity.
- `AssessmentVersion` owns immutable title, instructions, timing, pass/scoring rules, question-set hash, and content hash.
- `AssessmentQuestion` pins an ordered question version and its marks to one assessment version.
- `AssessmentAttempt` pins the published assessment/version IDs and full assessment, question, answer-key, and scoring snapshots needed to reproduce a result.

## Lifecycle and invariants

Question and assessment content is edited only while its version is `draft`. Publishing records the actor and time. Model middleware prevents save, update, replacement, and deletion operations from changing a published version. A subsequent edit creates a new version number; it never mutates the published record.

Assessment links accept only published question versions. Service-layer validation also requires linked questions to share the assessment organization and subject. Duplicate question links are rejected by both service validation and unique indexes.

Attempt responses use explicit nested schemas. Duplicate responses and responses outside the snapshotted assessment are rejected. The API boundary rejects duplicate, unknown, fractional, and out-of-range legacy MCQ responses.

## Historical reproducibility

Every new kernel attempt contains immutable copies of the assessment rules and question material used at submission. Existing MCQ and practice attempt writers now also store compatible snapshots. Result readers prefer snapshots and use current source records only for older attempts created before this change. Archiving or revising source content therefore does not change a new historical result.

## Compatibility and rollout

The kernel is additive. `legacySource.collection` and `legacySource.id` preserve source identity for later migration and reconciliation. Attempt sessions include optional canonical assessment and question-version references, allowing Step 6 workflow migration without breaking current callers.

Rollout can be disabled by leaving new publishing endpoints unexposed. Existing collections and readers remain available. Rollback does not require deleting kernel records; stop new kernel writes and keep snapshot-aware fallback readers enabled.
