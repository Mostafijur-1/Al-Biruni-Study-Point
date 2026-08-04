# 21 — Phased Implementation Roadmap

## Phase 1 — Foundation and P0 stabilization

**Objective:** close authorization/data-integrity risks and create safe foundations.

**Current-state findings:** scattered role checks, destructive academic deletes, mutable formal exams, optional cron secret, no migrations/audit, mixed-language UI and overloaded navigation.

**Scope:** R1–R4, migration ledger, AuditLog, environment schema, result void/correction, exam invariants/version seed, session hardening design, terminology/nav first pass, integration-test harness.

**Out of scope:** attendance, fees, guardian, new AI/labs/gamification.

**Affected areas:** `lib/auth`, `lib/permissions.ts`, result/exam/notification APIs, assessment models, `proxy.ts`, navigation/layout, messages/copy, CI/docs.

**Data changes:** additive AuditLog, migration ledger, assessment version/snapshot fields; no destructive removal.

**API changes:** policy-backed existing contracts; destructive DELETE disabled/replaced; stable error codes/request IDs.

**UX changes:** task-based nav, Bangla corrections, explicit archive/void behavior.

**Security:** default-deny policies, scope tests, required cron secret, broadcast restriction.

**Test plan:** unit + DB integration authorization matrix + exam scoring/publish + destructive-path negative tests + E2E login/role routing.

## Phase 2 — Academic core

Organization/branch, academic session, subject/chapter/topic, batch, enrollment, teacher assignment, routine and class sessions. Migrate embedded teacherDomain using dual-read parity. No attendance UI until roster/session truth is validated.

## Phase 3 — Attendance and class operations

Mobile-first class attendance, corrections/audit, low-attendance alerts, teacher dashboard “today,” batch/student views. Use idempotent sheet submission.

## Phase 4 — Assessment and CQ core

Unified question versions, guided exam builder, frozen exam version, reliable autosave/submit, result moderation/publication, CQ submission/rubric/feedback, practice adapters and reproducible analytics.

## Phase 5 — Student and teacher experience

Role-focused dashboards, course/module/material hierarchy, actionable learning plan, assignment flow, notifications, reduced engagement clutter and performance/component refactor.

## Phase 6 — Admissions and finance

Admission lifecycle, fee plans, invoices, payments/allocations, receipts, dues, refunds/adjustments, cash reconciliation and reports. Financial ledger is immutable and idempotent.

## Phase 7 — Guardian and communication

Verified guardian linking, multi-child portal, scoped attendance/result/assignment/fee views, notification preferences/templates/delivery history.

## Phase 8 — Reporting, accessibility and operations

Metric catalog, exports, management reports, structured logs/error tracking, backup/restore, load/accessibility testing, performance budgets and staging/deployment hardening.

## Phase 9 — Optional innovation

Only after P0 and major P1 acceptance: science lab framework/content expansion, explainable recommendations, reviewed AI-assisted content, grounded tutor, and validated optional ERP modules.

## Phase completion template

Every phase must report: changes completed, files modified, migrations/tests added, validation results, limitations, remaining risks, and next phase. A phase is not complete if authorization, migration rollback, build, tests, mobile and accessibility checks are unverified.
