# 22 — Risk Register

Likelihood/impact: Low, Medium, High, Critical.

| ID | Risk | Likelihood | Impact | Evidence/trigger | Mitigation / owner |
|---|---|---:|---:|---|---|
| SEC-01 | Cross-teacher formal result access | High | Critical | Arbitrary `examId` query and teacher detail GET | Close in Phase 1; security/assessment owner |
| DATA-01 | Teacher wipes all subject history | Medium | Critical | Hard delete route at `teacher/results/[id]` | Disable; void/correction/audit |
| ASM-01 | Incorrect percentages/pass state | Medium | Critical | Exam totalMarks can differ from question mark sum | Publish invariant + immutable version |
| OPS-01 | Public mass reminder if secret absent | Medium | High | Conditional cron auth | Required env validation; deployment owner |
| SEC-02 | Teacher broadcasts outside assignment | Medium | High | Teacher allowed, recipient query global/class | Permission/scope/approval/audit |
| TEN-01 | Future cross-branch data leakage | High | Critical | No tenant keys/models | Tenancy before branch features |
| MIG-01 | Irreversible schema/data loss | High | Critical | No migration framework/backfill checks | Migration ledger, backup, dual-read, rollback |
| PRIV-01 | Telemetry/privacy over-collection | Medium | High | IP/UA and push endpoints stored, no retention docs | Minimize, TTL, consent/privacy notice |
| REL-01 | Exam submission inconsistency under concurrency | Medium | High | Session and attempt updates are separate operations | Transaction/idempotency tests, outbox |
| PERF-01 | Slow student workflow on mobile | High | High | Client fan-out and large bundles | Dashboard aggregation, budgets, route splitting |
| UX-01 | Student cognitive overload | High | Medium | 17 student nav items | Task-based IA, analytics, progressive disclosure |
| UX-02 | Broken trust from placeholders | High | Medium | Public/teacher placeholders and 501 APIs | Hide or finish |
| DOC-01 | Operators follow stale deployment/architecture docs | High | Medium | Locale/Sentry/Upstash/Mux claims mismatch source | Rewrite docs/ADRs |
| AUTH-01 | One refresh token prevents multi-device control | Medium | Medium | Single hash on User | Session collection/token families |
| DEP-01 | Unknown dependency vulnerabilities | Unknown | High | Advisory audit unavailable | Approved CI scanner; lockfile review |
| ACC-01 | Accessibility regression undetected | High | Medium | No browser/axe tests | E2E accessibility gate/manual QA |
| FIN-01 | Financial corruption if built on current models | High | Critical | No ledger/idempotency/branch truth | Defer until Phase 6 foundation |
| AI-01 | Unreviewed inaccurate questions | Medium | High | AI ingestion saves questions directly into teacher-set bank | Draft/provenance/reviewer/version workflow |
| PROD-01 | Feature sprawl delays core operations | High | High | P3 engagement/lab breadth precedes attendance/fees | Freeze P3; enforce priority matrix |

## Review cadence

Review at each phase start/end and before every production migration. P0 risks require named owner, acceptance test, rollback and deployment sign-off.
