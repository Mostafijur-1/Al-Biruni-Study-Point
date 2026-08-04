# 07 — Technical Debt Report

## Architecture and code health

| Finding | Evidence | Impact | Priority / complexity | Direction |
|---|---|---|---|---|
| Client monoliths | `McqPracticeRunner` 1,798 lines; `AdminPracticeManager` 1,408; `LabConceptVisualizer` 1,288; `TeacherMcqReview` 1,280 | Changes are risky; tests target rules, not orchestration/UI | P1 / high | Split by use case, state machine, form, and presentation |
| Scattered authorization | 65 direct role checks; unused `can()` in `lib/permissions.ts:30` | Inconsistent policy and scope gaps | P0 / high | Central policy functions returning scoped queries |
| Route handlers own domain logic | Exam, result, notification and question routes query models directly | Hard to test transactions and permissions | P1 / high | Application services + repositories only where they add value |
| Duplicate assessment models | Formal and practice question/attempt/result models | Rules drift and analytics fragment | P1 / high | Unified question version + assessment/attempt kernel, phased |
| Mutable/hard-deleted academic history | Teacher result and exam deletion cascades | Irrecoverable history and audit loss | P0 / medium | Void/archive/correction records; privileged purge only |
| No migrations | No migration files/scripts; hot-reload schema patch helper | Schema changes are not reviewable/reversible | P0 / medium | Versioned migration runner + migration ledger |
| Incomplete APIs/pages shipped | Three 501 handlers and four placeholder pages | Broken promises and SEO/user confusion | P1 / low-medium | Hide or finish coherent journeys |
| Obsolete i18n | `next-intl` has zero imports; locale branches remain; docs advertise `/en` | Bundle/developer complexity and inconsistent copy | P1 / medium | Remove dependency/branches after terminology inventory |
| Stale architecture docs | `docs/ARCHITECTURE.md:18-20` describes `app/[locale]`; claims Sentry/Upstash/Mux | Operations and onboarding misinformation | P1 / low | Rewrite as current/target ADRs |
| Weak nested schemas | `answers: { type: [Object] }` in attempt models | Reduced validation/indexability | P0/P1 / medium | Explicit sub-schemas and immutable snapshots |
| Environment contract incomplete | `CRON_SECRET` and VAPID variables used but absent from `.env.example` | Misconfigured cron can become public | P0 / low | Zod environment schema, required-in-production checks |
| Debug/dead code | `console.log` at `TeacherResultsDashboard.tsx:541`; 2 lint warnings | Noise and leakage risk | P2 / low | Remove; structured logging |
| Unused dependency | `next-intl` declared, no imports | Maintenance/audit surface | P2 / low | Remove in Bangla-only cleanup |

## Data and API debt

- `User` mixes identity, student profile, teacher scope, teacher billing, refresh state, and AI profile.
- Course uses both `title` and `titleBn` even though the product is single-language.
- `PracticeResult` and `PracticeAttempt` duplicate scoring truth; teacher deletion deletes both plus all subject attempts.
- Published questions/exams are not versioned, so later edits can make historical results non-reproducible.
- Object IDs and query enums are often accepted as raw strings.
- Teacher scope logic maps English/Bangla subject aliases in multiple handlers.
- No request correlation ID, audit log, outbox, or domain event boundary.

## Test debt

The 59 passing tests are valuable rule-level regression tests. There are no configured browser E2E, component tests, API integration tests, database transaction tests, authorization matrix tests, or coverage threshold. No test dependency such as Playwright/Vitest is declared. The most dangerous behavior—cross-teacher reads, hard deletion, publish invariants, refresh concurrency, notification scope—is untested.

## CI/DevOps debt

CI runs typecheck, lint, tests, build and SonarQube, which is a good base. Missing controls include branch-protection evidence, dependency advisory scanning, secret scanning, preview smoke tests, staging data isolation, migration gates, backup restore drills, and deployment rollback documentation. The dependency advisory audit could not be completed in this environment due network policy.
