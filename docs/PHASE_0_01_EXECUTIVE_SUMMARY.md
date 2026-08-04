# 01 — Executive Summary

## Product assessment

ABSP is a working Bangla-first learning and MCQ platform, not yet a coaching-center operating system. Its strongest implemented loop is student practice: question selection, server-authoritative attempt sessions, scoring, result history, mistake review, mastery, recommendations, and engagement features. Formal teacher-created MCQ exams and teacher question workflows also exist. The public site and PWA shell are deployable.

The product has grown outward into gamification, community, focus, challenges, formula drills, AI ingestion, and 18 science simulations before foundational operations were built. There is no real batch/enrollment model, attendance, guardian link, admission lifecycle, fees ledger, or branch isolation. This creates a high feature-to-foundation imbalance.

## Technical assessment

The stack is appropriate and should be retained. TypeScript strict mode, centralized auth helpers, Zod on many mutations, HTTP-only access/refresh cookies, server-authoritative exam timing, upload signature validation, CSP/security headers, CI quality gates, and Mongo indexes are good foundations.

The main weaknesses are inconsistent authorization depth, large client components, direct model access from route handlers and services, incomplete workflows exposed as routes, no migration framework, and documentation that describes an obsolete bilingual architecture. The nominal permission table in `lib/permissions.ts:3` is unused; actual access is enforced through 65 scattered role checks. `types/index.ts:1` supports only `admin`, `teacher`, and `student`.

## Highest-priority decisions

1. Freeze destructive result deletion and close teacher ownership/scope gaps before adding features.
2. Reconcile formal-exam marks with immutable published question versions.
3. Introduce organization/branch/session/batch/enrollment foundations before attendance, guardian, or finance.
4. Replace role-name-only checks with permission + resource-scope policies.
5. Consolidate the student navigation from 17 destinations into task-oriented groups.
6. Finish or hide placeholders (`batches`, `enrollments`, CQ submission, About, FAQ, course detail, CQ review).
7. Complete the single-language migration: remove dead locale branches, `next-intl`, English fallback UI, and stale `/bn` documentation.
8. Split the 1,000–1,800-line client components along domain/use-case boundaries.

## Recommended disposition

- Keep and harden: auth cookie pattern, question validation, attempt sessions, practice selection, mistake review, course/video basics, security headers, CI, responsive shell.
- Improve: formal exams, student dashboard, teacher result workflows, AI question review, analytics, PWA notifications, science lab.
- Merge: game hub/challenge/goals/focus/formulas/coach/community into a smaller “অনুশীলন ও অগ্রগতি” experience with feature flags.
- Replace: authorization policy layer, published assessment model, destructive academic mutations, information architecture.
- Remove after verification: `next-intl`, locale conditionals, obsolete bilingual docs, duplicate admin analytics route, debug logging, unused permission helper if superseded.
- Incomplete/broken: CQ submission/review, batches/enrollments, About/FAQ/course-detail placeholders, authenticated visual flows not verified in this environment.

## Go/no-go recommendation

Proceed to a narrowly scoped Phase 1 only after approval. Phase 1 should contain P0 stabilization, authorization-policy groundwork, result immutability, scoring invariants, environment validation, terminology cleanup, and navigation consolidation—not attendance, finance, AI tutor, or more simulations.
