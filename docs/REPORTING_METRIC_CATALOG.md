# Reporting metric catalog

Step 9 reporting projections are disposable read models. Enrollment, attendance, assessment, focus, routine, and immutable finance collections remain authoritative. `REPORTING_PROJECTIONS_ENABLED` stays false until staging reconciliation and latency evidence are approved; a missing or invalid projection falls back to source reads.

| Projection | Metric owner | Period/key | Authoritative inputs | Staging p95 budget |
| --- | --- | --- | --- | ---: |
| `student-today` | Student experience | Dhaka day / student | active enrollment, attendance records, submitted assessment attempts, completed focus sessions | 250 ms |
| `teacher-today` | Academic operations | Dhaka day / teacher | active assignments, class sessions, submitted attendance sheets | 250 ms |
| `attendance-daily` | Academic operations | Dhaka day / scope | submitted attendance sheet summaries | 300 ms |
| `assessment-trend` | Assessment | Dhaka month / student | submitted assessment attempts | 300 ms |
| `finance-monthly` | Finance | month / scope | immutable invoices, adjustments, allocations, cash transactions | 350 ms |

The budgets are release gates, not measured production claims. On staging, run `check:reporting-projections` and retain `executionStats`, then sample endpoint latency under representative concurrency. Do not add source indexes until the captured query plan demonstrates a scan or sort problem. Projection access uses the unique identity index and the scope/type/period/cursor index.

## Operations

- Rebuild requires explicit environment, database, organization, branch, date, `--apply`, and `--confirm=step9-reporting-projections-v1`.
- Reconciliation rebuilds expected values in memory and compares SHA-256 hashes without mutating projections. Exit code 2 means missing or divergent rows.
- Every source query has a finite cap. If a branch reaches a cap, split projection work by a narrower key before rollout rather than silently increasing limits.
- Rollback is immediate: set `REPORTING_PROJECTIONS_ENABLED=false`. No authoritative records are deleted or rewritten.
