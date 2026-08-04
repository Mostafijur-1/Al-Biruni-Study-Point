# ABSP Phase 0 — Discovery and Complete Repository Audit

Audit date: 2026-08-04 (Asia/Dhaka)

Scope: repository `main` at `dacd125`, local production build, local HTTP behavior, and read-only checks of `https://absp.vercel.app`. No product code, schema, or production data was changed.

## Phase objective

Establish an evidence-backed current-state map, identify P0/P1 risks, and define a staged target architecture before Phase 1 implementation.

## Current-state findings

- Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS 4, MongoDB/Mongoose, JWT cookies, Cloudinary, Web Push, and three AI providers.
- 46 page routes, 76 API handler files, 36 Mongoose models, and 52 client-rendered TSX files.
- Product scope is student-heavy: practice, formal MCQ exams, videos, CQ assignment creation, learning insights, mistake review, goals, focus, community, gamification, daily challenge, formulas, study coach, and 18 science simulations.
- Core coaching operations are largely absent: branch/session/batch/enrollment, attendance, routine, guardian, admission lifecycle, fees/payments, and auditable finance.
- Confirmed P0 issues include teacher data-scope gaps, destructive result deletion, and scoring configuration that can diverge from question marks.

## Phase scope

Read-only discovery, validation, live route checks, current/target maps, priority decisions, migration strategy, and roadmap.

## Out of scope

Application refactors, schema migrations, account creation, production-data inspection, authenticated role walkthroughs, and destructive endpoint testing.

## Validation summary

| Check | Result | Evidence |
|---|---|---|
| Unit/rule tests | Pass: 59/59 | `npm.cmd test` |
| Type check | Pass | `npm.cmd run typecheck` |
| Lint | Pass with 2 warnings | Unused `Star` and `studentId` |
| Production build | Pass; 112 generated routes/assets | `npm.cmd run build` |
| Local public routes | 200 | `/`, `/login`, `/student`, `/student/practice` |
| Local protected routes | 307 to login | `/teacher`, `/admin` |
| Legacy locale route | 301 to `/` | `/bn` |
| Local health | 503 after 48.7 s | Database network unavailable in sandbox |
| Live health | 200 in 3.15 s | `https://absp.vercel.app/api/health` |
| Live root/security headers | 200; CSP, HSTS, nosniff, DENY present | Header-only live check |
| Interactive browser QA | Not available | No browser session was exposed |
| Dependency advisory audit | Not run | Network policy rejected sending dependency metadata to npm |

## Required deliverables

1. [Executive summary](./PHASE_0_01_EXECUTIVE_SUMMARY.md)
2. [Existing feature inventory](./PHASE_0_02_FEATURE_INVENTORY.md)
3. [Existing route map](./PHASE_0_03_ROUTE_MAP.md)
4. [Current role map](./PHASE_0_04_CURRENT_ROLES.md)
5. [Current database model map](./PHASE_0_05_DATABASE_MODEL_MAP.md)
6. [Current API map](./PHASE_0_06_API_MAP.md)
7. [Technical debt report](./PHASE_0_07_TECHNICAL_DEBT.md)
8. [UX audit](./PHASE_0_08_UX_AUDIT.md)
9. [Security audit](./PHASE_0_09_SECURITY_AUDIT.md)
10. [Performance audit](./PHASE_0_10_PERFORMANCE_AUDIT.md)
11. [Redundancy report](./PHASE_0_11_REDUNDANCY.md)
12. [Missing-feature report](./PHASE_0_12_MISSING_FEATURES.md)
13. [Proposed information architecture](./PHASE_0_13_INFORMATION_ARCHITECTURE.md)
14. [Proposed role and permission matrix](./PHASE_0_14_PERMISSION_MATRIX.md)
15. [Proposed database architecture](./PHASE_0_15_DATABASE_ARCHITECTURE.md)
16. [Proposed service and API architecture](./PHASE_0_16_SERVICE_API_ARCHITECTURE.md)
17. [Proposed design system](./PHASE_0_17_DESIGN_SYSTEM.md)
18. [Bangla terminology guide](./PHASE_0_18_BANGLA_TERMINOLOGY.md)
19. [Feature-priority matrix](./PHASE_0_19_PRIORITY_MATRIX.md)
20. [Migration strategy](./PHASE_0_20_MIGRATION_STRATEGY.md)
21. [Phased implementation roadmap](./PHASE_0_21_ROADMAP.md)
22. [Risk register](./PHASE_0_22_RISK_REGISTER.md)

Cross-cutting detailed records: [Recommendation register](./PHASE_0_23_RECOMMENDATION_REGISTER.md).

## Phase completion status

Documents only. No migrations or tests were added. Phase 1 must not start until this audit is approved.
