# 19 — Feature Priority Matrix

Impact: 1–5. Effort: S/M/L/XL. Recommendation details are in `PHASE_0_23_RECOMMENDATION_REGISTER.md`.

| ID | Work | Priority | Impact | Effort | Decision/dependency |
|---|---|---:|---:|---:|---|
| R1 | Central authorization + teacher scope fixes | P0 | 5 | L | First; blocks every operational module |
| R2 | Academic record immutability + audit log | P0 | 5 | M/L | Disable destructive paths immediately |
| R3 | Exam publish/scoring/version invariants | P0 | 5 | L | Before more formal exams/results |
| R4a | Environment validation, cron/broadcast/PWA hardening | P0 | 5 | M | Immediate deployment safety |
| R4b | Migration framework and data backup/rollback discipline | P0 | 5 | M | Before target schema changes |
| R5 | Organization/branch/session/batch/enrollment/assignment core | P1 | 5 | XL | Foundation for attendance, guardian, fees |
| R6 | Student/teacher/admin IA + Bangla terminology cleanup | P1 | 4 | L | Preserve redirects and usage analytics |
| R7 | CQ submission/evaluation end-to-end | P1 | 4 | L | After asset/audit policies |
| R8 | Attendance + routine/class sessions | P1 | 5 | XL | After R5 |
| R9 | Service boundaries, component split, dashboard aggregation | P1 | 4 | L | Parallel after P0 policies stabilize |
| R10 | Auth recovery and session/device management | P1 | 4 | L | After session collection |
| R11 | Fees, invoices, payments, receipts | P1 | 5 | XL | After R5; immutable ledger/idempotency |
| R12 | Guardian linking and focused portal | P2 | 4 | L | After student/fee/attendance truth exists |
| R13 | Notification templates/preferences/delivery log | P2 | 3 | L | After scoped recipients/outbox |
| R14 | Analytics/report catalog | P2 | 3 | L | After metric definitions and core data |
| R15 | Science lab framework refactor/content QA | P3 | 2 | L | No new breadth until P0/major P1 done |
| R16 | AI tutor/personalized study planning | P3 | 2 | XL | Approved content, privacy and evaluation prerequisite |
| R17 | Optional ERP modules | Decision | 1–3 | XL | Needs operational discovery; disabled by default |

## Immediate stop-doing list

- No new gamification destination, public leaderboard, AI tutor, simulation, payroll, library, inventory, transport or hostel work.
- No automatic destructive migration or hard delete of results/attempts.
- No new role name without organization/branch/resource-scope policies.
