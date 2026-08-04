# 23 — Detailed Recommendation Register

These records normalize the proposed changes across the audit. Minor actions in other documents are acceptance details of the nearest record, not independent implementation authorization.

## R1 — Central authorization and tenant/resource scope

- **Current implementation:** three role strings, scattered `requireAuth([...])` calls, embedded `teacherDomain`; unused permission table.
- **Problem:** authorization depth varies by endpoint; branch isolation is impossible.
- **Evidence:** `lib/permissions.ts:3-31`; formal result gap at `app/api/mcq/results/route.ts:144-155`.
- **Affected users:** every role, especially students whose results are exposed.
- **Business impact:** privacy incidents and inability to delegate staff duties safely.
- **Educational impact:** private answers/results can be viewed or changed outside assignment.
- **Proposed solution:** organization/branch-aware permission policies that return database scopes; default deny.
- **Alternative considered:** expand role-name conditionals; rejected because combinations and resource scope keep growing.
- **UI changes:** hide unauthorized modules/actions; explain denials safely.
- **UX changes:** role/task-specific navigation and fewer irrelevant choices.
- **Backend changes:** RequestContext, policy layer, scoped-query helpers, denial logging.
- **Database changes:** Organization, Branch, Role/Permission/Assignment, TeacherAssignment.
- **API changes:** all sensitive endpoints call policy before read/mutation; close teacher result/broadcast gaps.
- **Security impact:** critical risk reduction; least privilege and branch isolation.
- **Migration impact:** dual-read legacy role/domain and new assignments; shadow-compare decisions.
- **Testing requirements:** role × action × scope integration matrix; cross-tenant/teacher negative tests.
- **Priority:** P0.
- **Estimated complexity:** High.
- **Dependencies:** migration framework, default organization/branch mapping.
- **Risks:** incorrect backfill could deny legitimate access; mitigate with parity logs/feature flag.
- **Acceptance criteria:** no teacher can read/mutate outside assignments; every operational query carries tenant scope; policy coverage test passes.

## R2 — Immutable academic history and audit trail

- **Current implementation:** teacher/admin DELETE routes hard-delete attempts/results/exams/questions.
- **Problem:** routine UI can irreversibly erase historical academic truth.
- **Evidence:** `app/api/teacher/results/[id]/route.ts:90-103`; exam delete cascades attempts.
- **Affected users:** students, teachers, management, guardians later.
- **Business impact:** disputes cannot be resolved; reporting becomes unreliable.
- **Educational impact:** progress/mistake history and feedback can disappear.
- **Proposed solution:** disable hard deletes; use void/archive/correction records and immutable AuditLog.
- **Alternative considered:** soft-delete boolean only; rejected because it lacks actor/reason/version semantics.
- **UI changes:** replace Delete with Archive/Void/Request correction and exact-scope confirmation.
- **UX changes:** show status/reason and recovery path.
- **Backend changes:** state-transition services and audit writer.
- **Database changes:** AuditLog, correction/reversal fields/documents, immutable result snapshots.
- **API changes:** deprecate DELETE; add `:void`, `:archive`, correction workflows.
- **Security impact:** better accountability; restrict purge to exceptional retention workflow.
- **Migration impact:** preserve every existing record; backfill neutral active status.
- **Testing requirements:** state transition, audit, authorization, replay and no-hard-delete tests.
- **Priority:** P0.
- **Estimated complexity:** Medium–High.
- **Dependencies:** R1 policy context.
- **Risks:** old UI may still call DELETE; return explicit deprecation error and update clients atomically.
- **Acceptance criteria:** ordinary product APIs cannot hard-delete academic/financial records; every sensitive mutation has actor/time/reason/request ID.

## R3 — Versioned exam publication and reproducible scoring

- **Current implementation:** mutable exam/question documents; arbitrary total/pass marks; percentage divides score by configured total.
- **Problem:** configured total can diverge from question marks; later edits can change historical meaning.
- **Evidence:** `McqExam.ts:24-28`; `mcq/exams/[id]/submit/route.ts:100-120`; publish only toggles a boolean.
- **Affected users:** students, teachers, management.
- **Business impact:** result disputes and loss of confidence.
- **Educational impact:** pass/fail and analytics may be wrong or non-reproducible.
- **Proposed solution:** publish validation + immutable ExamVersion containing rules and QuestionVersion references/snapshots; compute total from sections/questions.
- **Alternative considered:** validate mutable documents only; rejected because historical reproducibility remains unsolved.
- **UI changes:** guided builder, validation summary, preview, explicit result publication.
- **UX changes:** block publish with field-specific Bangla guidance.
- **Backend changes:** transactional publish, server timing, idempotent submit, score calculator.
- **Database changes:** QuestionVersion, ExamVersion, section/version-question, attempt snapshot.
- **API changes:** `publish` returns frozen version; attempts target version ID.
- **Security impact:** unpublished answers remain scoped; version state controls visibility.
- **Migration impact:** new exams versioned; legacy exams use compatibility reader until republished/mapped.
- **Testing requirements:** marks/pass invariants, duplicate answers, concurrency, expiry, result reproduction.
- **Priority:** P0.
- **Estimated complexity:** High.
- **Dependencies:** R1/R2, migration tooling.
- **Risks:** compatibility with active attempts; version only future publishes and preserve active sessions.
- **Acceptance criteria:** published version cannot mutate; total marks equal rule-derived total; recomputation matches stored result exactly.

## R4 — Environment, notification and telemetry hardening

- **Current implementation:** optional cron secret, teacher-wide broadcasts, public unthrottled PWA tracking/subscription, console logging.
- **Problem:** deployment misconfiguration can expose mass actions and telemetry endpoints.
- **Evidence:** cron route lines 30-33; broadcast lines 22-53; PWA routes parse raw JSON.
- **Affected users:** all subscribers and operators.
- **Business impact:** spam, privacy exposure, storage abuse and weak incident response.
- **Educational impact:** disruptive or inappropriate messages reduce trust.
- **Proposed solution:** production environment schema, required cron auth, notification permission/scope, Zod/rate limits, delivery log, privacy retention, structured logging.
- **Alternative considered:** operational convention only; rejected because missing env currently changes authorization behavior.
- **UI changes:** recipient preview, approval/confirmation, delivery status.
- **UX changes:** preferences and reduced notification spam.
- **Backend changes:** outbox/worker boundary, redacted logger, request IDs.
- **Database changes:** Notification, Delivery, Preference; TTL/anonymization for telemetry.
- **API changes:** POST-only protected cron; admin/assigned-announcement workflows; validated PWA contracts.
- **Security impact:** closes mass-action and abuse paths.
- **Migration impact:** existing subscriptions retained after validation/deduplication; stale endpoints expired.
- **Testing requirements:** missing-secret startup failure, recipient-scope tests, rate-limit and expired-endpoint tests.
- **Priority:** P0/P1.
- **Estimated complexity:** Medium–High.
- **Dependencies:** R1 and environment schema.
- **Risks:** overly strict rollout may stop reminders; stage with dry-run recipient counts.
- **Acceptance criteria:** production cannot start cron without secret; teachers cannot target unassigned recipients; public telemetry is bounded and retained by policy.

## R5 — Academic operating foundation

- **Current implementation:** class strings and embedded teacher student IDs; batch/enrollment APIs are placeholders.
- **Problem:** attendance, routine, guardian and fees have no reliable roster/session foundation.
- **Evidence:** `User.teacherDomain`; `/api/batches` and `/api/enrollments` return 501.
- **Affected users:** administrators, teachers, students, future guardians/accounts staff.
- **Business impact:** coaching operations remain outside ABSP.
- **Educational impact:** no class attendance, schedule or cohort-level support.
- **Proposed solution:** organization/branch, academic session, canonical subject hierarchy, batch, enrollment, teacher assignment, routine and class session.
- **Alternative considered:** keep embedding arrays in User; rejected for history, scale and audit.
- **UI changes:** guided batch creation/enrollment/teacher assignment and roster views.
- **UX changes:** task flows with search, capacity/conflict feedback and bulk actions.
- **Backend changes:** enrollment/transfer/assignment services and conflict rules.
- **Database changes:** entities/indexes in proposed architecture.
- **API changes:** workflow endpoints for enroll, transfer and assign teacher.
- **Security impact:** branch/batch/subject scope becomes enforceable.
- **Migration impact:** map existing class/domain data with exception reports and dual reads.
- **Testing requirements:** roster uniqueness/history, transfer, capacity, assignment and isolation tests.
- **Priority:** P1.
- **Estimated complexity:** Extra High.
- **Dependencies:** R1 and migration strategy.
- **Risks:** legacy data ambiguity; require admin resolution rather than guessed mapping.
- **Acceptance criteria:** every active student has valid session/branch/batch enrollment; every teacher scope derives from assignments.

## R6 — Bangla-first task-oriented experience and design system

- **Current implementation:** one Bangla dictionary plus many English strings and dead locale branches; 17 student nav destinations; no loaded Bangla font.
- **Problem:** inconsistent voice, cognitive overload and variable rendering.
- **Evidence:** `DashboardMobileNav.tsx:46-81`, English literals across teacher/admin, `app/globals.css:84` font stack without font loading.
- **Affected users:** all roles, especially mobile students.
- **Business impact:** higher support/training cost and weaker local trust.
- **Educational impact:** attention shifts from next learning action to feature discovery.
- **Proposed solution:** approved terminology, six-task student IA, actionable teacher/admin IA, self-hosted Bangla font, standardized components/states.
- **Alternative considered:** translate strings in place only; rejected because architecture and task grouping remain poor.
- **UI changes:** new nav/grouping, consistent type/spacing/status/data views.
- **UX changes:** progressive disclosure and one primary purpose/action per screen.
- **Backend changes:** dashboard aggregation/read models and permission-aware nav config.
- **Database changes:** none initially; optional saved views later.
- **API changes:** dashboard summary endpoint/read service.
- **Security impact:** hiding actions is not authorization; policies remain server-side.
- **Migration impact:** redirects preserve old URLs; locale branches/dependency removed after copy parity.
- **Testing requirements:** responsive, keyboard, screen-reader, Bangla wrap, route redirect, task-usability tests.
- **Priority:** P1.
- **Estimated complexity:** High.
- **Dependencies:** R1 navigation permissions and terminology approval.
- **Risks:** secondary feature discovery drops; contextual links and analytics mitigate.
- **Acceptance criteria:** no English fallback branch remains; main journeys use approved terms; student top-level nav ≤6; WCAG checks pass.

## R7 — Complete CQ/assignment workflow or hide it

- **Current implementation:** assignment creation/listing exists; submit API and teacher review page are placeholders.
- **Problem:** the UI promises an academic workflow that cannot complete.
- **Evidence:** `app/api/cq/submit/route.ts`; `app/(dashboard)/teacher/review-cq/page.tsx`.
- **Affected users:** students and teachers.
- **Business impact:** manual workaround and lost confidence.
- **Educational impact:** written-answer practice and feedback are unavailable.
- **Proposed solution:** until complete, hide submission claims; then build scoped submission, private assets, rubric, feedback, revision and status history.
- **Alternative considered:** leave placeholders visible; rejected as misleading.
- **UI changes:** guided upload/status/revision and teacher queue.
- **UX changes:** clear deadlines, file requirements, recoverable retry and feedback state.
- **Backend changes:** submission/evaluation services and controlled file access.
- **Database changes:** AssignmentVersion, AssignmentSubmission, SubmissionAsset, Evaluation/Rubric.
- **API changes:** idempotent submit, return-for-revision, evaluate, publish feedback.
- **Security impact:** student ownership, teacher assignment scope, private signed assets.
- **Migration impact:** existing CqAssignment records map to assignments; no submission data to migrate.
- **Testing requirements:** upload validation, scope, retry/idempotency, deadline/extension and grading tests.
- **Priority:** P1.
- **Estimated complexity:** High.
- **Dependencies:** R1, R2, R5, asset policy.
- **Risks:** storage cost/malware/privacy; size/type limits and controlled delivery.
- **Acceptance criteria:** student can submit/retry safely; assigned teacher can grade; unauthorized users cannot list/download assets.

## R8 — Service/component decomposition and performance budgets

- **Current implementation:** large client components and route handlers with direct model logic; practice submit N+1 reads.
- **Problem:** slow/risky delivery and mobile performance.
- **Evidence:** component line counts; `practice/submit/route.ts:168-171`; dashboard fan-out.
- **Affected users:** all roles; developers/operations.
- **Business impact:** regressions and maintenance cost.
- **Educational impact:** slow or fragile exams/practice interrupt learning.
- **Proposed solution:** extract tested services/state machines, split client islands, aggregate dashboards, paginate/project queries, set budgets.
- **Alternative considered:** framework migration; rejected as unnecessary.
- **UI changes:** behavior-preserving component decomposition and better skeleton/error states.
- **UX changes:** faster initial action and consistent recovery.
- **Backend changes:** application services, batch reads, cursor pagination, measured caching.
- **Database changes:** query-driven indexes only.
- **API changes:** bounded pages and dashboard summary; preserve legacy adapters.
- **Security impact:** centralized services make policy enforcement consistent; avoid shared caching of private data.
- **Migration impact:** incremental file-level refactor, no big-bang rewrite.
- **Testing requirements:** characterization tests, bundle/Web Vitals, explain plans, load test in staging.
- **Priority:** P1.
- **Estimated complexity:** High.
- **Dependencies:** policy and error primitives.
- **Risks:** refactor regression; slice by coherent workflow with parity tests.
- **Acceptance criteria:** no core client component >500 lines without justification; no per-question DB loop; budgets and critical E2E pass.

## R9 — Attendance, finance and guardian modules in dependency order

- **Current implementation:** absent; teacher upload charges are not a finance system.
- **Problem:** major coaching operations remain manual.
- **Evidence:** no related models/routes; feature inventory.
- **Affected users:** staff, teachers, students, guardians.
- **Business impact:** ABSP cannot be the daily operating system.
- **Educational impact:** attendance/support signals and guardian visibility are missing.
- **Proposed solution:** after R5, build attendance/routine first, ledger-backed fees second, verified guardian portal third.
- **Alternative considered:** parallel CRUD modules now; rejected because tenant/roster truth is missing.
- **UI changes:** mobile attendance, front-desk payment, focused guardian exceptions.
- **UX changes:** fast bulk marking, clear receipts/dues, child switcher.
- **Backend changes:** workflow services, transactions, idempotency and outbox notifications.
- **Database changes:** attendance, invoice/payment/allocation, guardian-link entities.
- **API changes:** mark sheet, allocate payment, link guardian workflows.
- **Security impact:** duty separation, linked-child ownership, financial audit.
- **Migration impact:** opening balances/import templates require separate approved plan.
- **Testing requirements:** attendance calculation/correction, money allocation/refund, link isolation, receipts.
- **Priority:** P1 attendance/finance; P2 guardian.
- **Estimated complexity:** Extra High.
- **Dependencies:** R1/R2/R5.
- **Risks:** financial/legal errors; do not claim full accounting compliance.
- **Acceptance criteria:** reconciled immutable payment history; auditable attendance; guardian sees linked children only.

## R10 — Consolidate optional engagement, science and AI

- **Current implementation:** multiple separate gamification/focus/community/coach routes, 18 simulations, AI ingestion.
- **Problem:** P3 breadth competes with core operations and fragments navigation.
- **Evidence:** student navigation and 20+ engagement models/routes; 1,288-line lab visualizer.
- **Affected users:** students, teachers, small engineering team.
- **Business impact:** high maintenance with limited operational return.
- **Educational impact:** rewards/tools can distract from learning goals; simulation accuracy needs review.
- **Proposed solution:** feature flags; merge engagement into practice/progress; retain only learning-linked rewards; modularize/QA labs; keep AI draft-only with provenance/review.
- **Alternative considered:** remove all immediately; rejected because working learning value/data may exist.
- **UI changes:** contextual tools, lower reward prominence, clear AI labels.
- **UX changes:** fewer top-level choices and explainable recommendations.
- **Backend changes:** shared attempt/reward adapters, experiment registry, AI review workflow.
- **Database changes:** keep current projections until usage decision; add provenance/version if retained.
- **API changes:** no new P3 endpoints; deprecate through aliases after analytics review.
- **Security impact:** moderation for community; approved-content and data minimization for AI.
- **Migration impact:** preserve data; feature flags and route redirects.
- **Testing requirements:** educational content review, simulation formula/range tests, safeguarding and AI evaluation.
- **Priority:** P3/defer.
- **Estimated complexity:** High.
- **Dependencies:** P0 and major P1 completion, product research.
- **Risks:** removing valued tools; use adoption/outcome data and staged experiments.
- **Acceptance criteria:** optional tools do not dominate nav; every retained feature has measurable learning outcome, owner, safety policy and maintenance budget.
