# ABSP Architecture and Database Remediation Execution Plan

**Prepared:** 30 August 2026

**Approach:** incremental modular-monolith remediation; retain Next.js and MongoDB

**Delivery rule:** complete, validate, commit, and push one step at a time; obtain approval before starting the next step

## 1. Decision summary

ABSP does not need a framework rewrite, microservices, or an immediate database-engine migration. The application should remain a Next.js modular monolith backed by MongoDB/Mongoose.

The logical schema and application boundaries do need remediation. Canonical academic collections currently coexist with legacy string fields and embedded authorization. Assessment truth is split across multiple collections, finance is a mutable monthly tracker rather than a ledger, and many route handlers directly implement persistence and authorization.

The target is reached through additive migrations:

`baseline -> expand -> backfill -> shadow compare -> switch authority -> compatibility window -> contract`

No production field or collection is removed in the release that introduces its replacement.

## 2. Non-negotiable engineering rules

1. Preserve existing production data and API compatibility unless a step explicitly introduces a versioned contract.
2. Never run a production mutation without a reviewed dry-run report, backup/restore evidence, and an explicit environment target.
3. Every operational academic record must ultimately have canonical scope: organization, branch where applicable, academic session, and stable entity IDs.
4. Published academic records and financial records are immutable. Changes use correction, reversal, adjustment, or new-version records.
5. Derived totals, mastery, dashboards, and summaries are rebuildable projections, not independent sources of truth.
6. Authorization must constrain the database query, not merely reject a document after an unscoped read.
7. Binary files live in private object storage; MongoDB stores metadata, ownership, integrity hash, and access state.
8. Every migration is idempotent, resumable, bounded, logged in `MigrationRecord`, and produces an exception report without sensitive values.
9. Each step has one focused commit. The commit is pushed only after its acceptance checks pass.
10. Unrelated working-tree changes are never included in an implementation commit.

## 3. Target architecture

```text
Presentation: Next.js pages and components
    -> route handler / server action
    -> authentication and validated RequestContext
    -> policy returning an authorized database scope
    -> application service / workflow
    -> repositories and transaction boundary
    -> typed response mapper

MongoDB bounded contexts
    Identity: User, Session, StaffRole, StudentProfile
    Academic: Organization, Branch, AcademicSession, Subject, Chapter, Topic,
              Batch, Enrollment, EnrollmentSubject, TeacherAssignment,
              RoutineSlot, ClassSession
    Assessment: Question, QuestionVersion, Assessment, AssessmentVersion,
                AssessmentQuestion, Attempt, ResponseSnapshot,
                ResultPublication, ResultCorrection
    Attendance: AttendanceSheet, AttendanceRecord, AttendanceCorrection,
                Idempotency, Outbox
    Finance: FeePlan, Invoice, InvoiceLine, Payment, PaymentAllocation,
             Adjustment, Expense, Receipt
    Content: Course, Module, LearningResource, private asset metadata
    Reporting: rebuildable read projections
```

## 4. Step-by-step delivery plan

### Step 0 - Plan and delivery controls

**Purpose:** establish the reviewed execution contract.

**Deliverables**

- This execution plan.
- One-step/one-commit/one-push discipline.
- Explicit approval boundary before every subsequent step.

**Acceptance**

- Plan agrees with the current code and existing Phase 2/3 gates.
- Only this document is committed.

**Commit:** `docs: add architecture remediation execution plan`

### Step 1 - Runtime safety and database baseline

**Purpose:** prevent migration work from proceeding against an unknown or incorrectly enabled environment.

**Deliverables**

- Add a read-only architecture readiness command that reports:
  - deployment environment classification;
  - academic and attendance write-gate state;
  - MongoDB topology capability without printing credentials;
  - collection counts, index names, null/missing scope counts, and orphan counts;
  - legacy-versus-canonical usage counts;
  - duplicate candidates for planned unique indexes.
- Make readiness fail closed when academic writes are enabled without valid rollout evidence.
- Add tests proving the command is read-only and redacts connection details.
- Document safe staging and production invocation.

**No production mutation:** this step is diagnostic only.

**Acceptance**

- Unit tests, typecheck, lint, and production build pass.
- Read-only report works without disclosing student data or secrets.
- Current environment contradictions are visible as blocking failures.

**Rollback:** remove the diagnostic command; no database rollback required.

**Commit:** `feat: add architecture readiness baseline`

### Step 2 - Repair index and scope invariants

**Purpose:** remove immediate schema hazards before expanding canonical authority.

**Deliverables**

- Replace the unconditional optional-field Batch unique index with a reviewed partial unique index.
- Define an index manifest for canonical operational collections.
- Add a migration that detects duplicates before creating or changing indexes.
- Add schema/index integration tests using a transaction-capable disposable MongoDB instance.
- Decide and document the supported tenancy model:
  - one ABSP organization with multiple branches initially;
  - organization scope remains explicit for future isolation;
  - users have an explicit home organization and scoped role/branch assignments where needed.

**Acceptance**

- Legacy records with missing canonical fields remain readable.
- Duplicate detection blocks unsafe index creation.
- Fresh database and migrated fixture database produce the expected indexes.

**Rollback:** restore the former non-unique compatibility index; retain added fields.

**Commit:** `fix: harden canonical scope indexes`

### Step 3 - Complete canonical academic authority

**Purpose:** make academic IDs and assignments the source of truth.

**Deliverables**

- Require canonical scope for all newly created batches, enrollments, teacher assignments, routines, class sessions, attendance, written exams, and reports.
- Add nullable canonical IDs to remaining legacy learning/content records.
- Implement bounded backfill and exception-report tooling for subject, chapter, topic, organization, branch, and academic session.
- Introduce adapters that accept legacy aliases only at import boundaries.
- Shadow-compare `TeacherAssignment` authorization with `User.teacherDomain`.
- Switch sensitive reads/writes to canonical policy after reviewed parity.

**Acceptance**

- 100% of active operational records have required canonical scope, or appear in an explicitly reviewed exception list.
- Authorization parity has no unresolved expansion of teacher access.
- New writes cannot persist raw subject/chapter strings without canonical IDs.
- Phase 2 evidence is completed for the exact commit before runtime cutover.

**Rollback:** switch the policy feature flag back to legacy reads; keep canonical records.

**Commit:** `feat: make canonical academic scope authoritative`

### Step 4 - Establish application service and policy boundaries

**Purpose:** stop route handlers from becoming independent business/data layers.

**Deliverables**

- Add shared `RequestContext`, scoped policy, repository, domain-error, idempotency, and transaction primitives.
- Migrate the highest-risk modules first: enrollment, written exams, student reports, and finance.
- Keep route handlers limited to authentication, parsing, service invocation, and response mapping.
- Add policy/action integration tests for admin, assigned teacher, unassigned teacher, owner student, and unrelated student.

**Acceptance**

- Migrated route handlers contain no direct Mongoose query construction.
- Scope is included in repository filters.
- Existing external API responses remain compatible.

**Rollback:** route adapters can call the prior implementation during the compatibility window.

**Commit:** `refactor: introduce scoped application services`

### Step 5 - Introduce the versioned assessment kernel

**Purpose:** create one reproducible source of truth for practice, MCQ, and written assessments.

**Deliverables**

- Add `Question`, `QuestionVersion`, `Assessment`, `AssessmentVersion`, and assessment-question linkage.
- Store curriculum IDs, language, provenance, status, difficulty, explanation, owner, and review state.
- Freeze published assessment versions.
- Add explicit validated response sub-schemas; stop writing `[Object]` answer arrays.
- New submitted attempts store immutable prompt/options/rules/scoring snapshots or references to immutable versions.
- Preserve legacy source IDs for adapters and traceability.

**Acceptance**

- Editing a draft cannot alter an already published version.
- A historical result is reproducible after the source question is edited or archived.
- Unknown, duplicate, fractional, and out-of-assessment responses are rejected.

**Rollback:** disable new publishing; legacy assessment readers remain active.

**Commit:** `feat: add versioned assessment kernel`

### Step 6 - Migrate practice and formal MCQ workflows

**Purpose:** remove duplicate assessment truth without breaking historical results.

**Deliverables**

- Route new practice and formal MCQ creation through the assessment kernel.
- Add legacy read adapters for `PracticeQuestion`, `McqQuestion`, `PracticeAttempt`, `PracticeResult`, and `McqExamAttempt`.
- Make the submitted attempt the authoritative result.
- Convert `PracticeResult` into a compatibility projection and make it rebuildable.
- Add idempotent autosave/submit and explicit result publication/correction flows.
- Backfill safe version/source references without rewriting historical marks.

**Acceptance**

- Practice and formal MCQ scoring regression suites pass against both legacy and new records.
- Repeated submission returns the stored outcome.
- Projection totals reconcile with authoritative attempts.
- No legacy historical score is silently changed.

**Rollback:** switch new-start routing to legacy; retain new immutable attempts.

**Commit:** `feat: migrate mcq workflows to assessment kernel`

### Step 7 - Harden written examinations and private assets

**Purpose:** make written results correctable, reproducible, and storage-safe.

**Deliverables**

- Store question files in private object storage with integrity metadata in MongoDB.
- Represent written exams through the assessment kernel or a strict adapter to it.
- Publish marks in a transaction with a frozen result-publication record.
- Add audited correction records instead of modifying published marks.
- Add retention and deletion rules for draft, published, and orphaned assets.

**Acceptance**

- Unauthorized users cannot fetch a private asset.
- Publication is atomic and idempotent.
- Published results cannot be overwritten.
- Correction history reproduces the visible current result.

**Rollback:** retain existing embedded files for reads until verified object-storage migration completes.

**Commit:** `feat: harden written exams and private assets`

### Step 8 - Replace the monthly finance tracker with a ledger

**Purpose:** make financial records suitable for real operational use.

**Product decision gate:** do not start until the owner confirms that ABSP will use the platform as an authoritative fee/payroll record.

**Deliverables**

- Add fee plans, student fee assignments, invoices, invoice lines, payments, allocations, adjustments, expenses, and receipts.
- Use integer taka consistently under the current whole-taka policy; document a future minor-unit migration if fractional currency becomes necessary.
- Require organization/branch scope, idempotency keys, immutable transaction records, reversals, and audit history.
- Convert monthly `due/clear` rows into opening invoices/payments through a reviewed migration.
- Rebuild monthly summaries from ledger entries.

**Acceptance**

- Partial payment, overpayment, discount, refund/reversal, and correction scenarios reconcile.
- Opening and closing totals match the reviewed legacy report.
- Replayed payment requests do not duplicate money.

**Rollback:** ledger remains read-only and the legacy tracker stays authoritative until reconciliation approval.

**Commit:** `feat: introduce immutable finance ledger`

### Step 9 - Reporting projections and query performance

**Purpose:** make dashboards fast without creating additional sources of truth.

**Deliverables**

- Define a metric catalog and ownership for every reported number.
- Build rebuildable projections for Student Today, Teacher Today, attendance, assessment trends, and finance summaries.
- Add cursor pagination and bounded filters to growing collections.
- Capture query shapes and use explain plans before adding indexes.
- Add projection rebuild and reconciliation commands.

**Acceptance**

- Projection values reconcile with source records.
- Core dashboard queries meet documented p95 budgets on representative staging data.
- No unbounded list endpoint remains in the migrated modules.

**Rollback:** fall back to authoritative-source queries; projections can be discarded and rebuilt.

**Commit:** `feat: add rebuildable reporting projections`

### Step 10 - Contract legacy schema and update architecture documentation

**Purpose:** remove obsolete authority only after a complete compatibility window.

**Deliverables**

- Prove zero production reads/writes of deprecated fields for one academic/reporting cycle or an explicitly approved shorter window.
- Archive, then remove legacy write paths.
- Remove `teacherDomain` authorization, string-only curriculum writes, duplicate result truth, and embedded binary writes.
- Retain required historical adapters according to the approved retention policy.
- Update `README`, architecture, deployment, recovery, schema map, and operational runbooks to match reality.

**Acceptance**

- Telemetry shows zero deprecated writes and no unexplained deprecated reads.
- Backup restore rehearsal succeeds before contraction.
- Full tests, typecheck, lint, build, authenticated browser journeys, accessibility smoke checks, and rollback drill pass.

**Rollback:** restore compatibility readers from the previous release; do not restore deprecated writers unless explicitly approved.

**Commit:** `refactor: retire legacy data authority`

## 5. Commit and approval protocol

For every step:

1. Confirm the step scope and current branch/worktree.
2. Implement only that step; preserve unrelated changes.
3. Run the step-specific checks plus tests, typecheck, lint, and build where applicable.
4. Review the exact diff and run `git diff --check`.
5. Commit only the scoped files using the planned commit subject or a more precise equivalent.
6. Push the current branch to its configured upstream.
7. Report:
   - commit hash;
   - files and migrations changed;
   - checks and results;
   - database/deployment actions actually performed;
   - limitations, risks, and rollback state.
8. Stop and ask for approval to begin the next numbered step.

Failed acceptance checks mean the step remains incomplete and must not be committed as complete. If a safe intermediate commit is necessary, it must be labeled explicitly and must not enable runtime authority.

## 6. Global completion criteria

The remediation is complete only when:

- canonical academic IDs and assignments are authoritative;
- published assessments and results are reproducible and immutable;
- attendance, assessment, written-result, and finance corrections are audited records;
- private binaries are outside MongoDB;
- finance is either explicitly a non-authoritative tracker or a reconciled immutable ledger;
- sensitive route handlers use scoped policies and application services;
- legacy authority has zero unexplained use;
- migrations, indexes, backups, restore, rollback, observability, authenticated journeys, and accessibility evidence are reviewed for the release commit.

## 7. Explicitly deferred

- Microservices or an event-streaming platform.
- A full MongoDB-to-PostgreSQL rewrite.
- AI tutoring or automated high-stakes grading.
- Additional gamification systems.
- Full ERP modules beyond validated ABSP operational needs.

PostgreSQL should be reconsidered only if multi-organization tenancy, ledger-grade finance, or complex relational reporting becomes a dominant product requirement. That decision should follow measured query and operational evidence rather than precede the schema-authority cleanup.
