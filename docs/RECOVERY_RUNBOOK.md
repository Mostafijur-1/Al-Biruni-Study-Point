# Recovery and restore rehearsal

1. Identify the incident window, release commit, affected canonical scope, and incident owner.
2. Disable the narrow write/authority flag involved; do not delete immutable evidence.
3. Preserve application logs, migration reports, audit records, and the Atlas snapshot identifier.
4. Restore the selected snapshot into an isolated non-production cluster/database. Never rehearse by overwriting production.
5. Run architecture readiness, schema/orphan/duplicate checks, domain DB suites, and source-to-projection reconciliation against the restored database.
6. Hash the snapshot reference before recording evidence; reports must contain counts only, never credentials, student samples, or connection strings.
7. Record restore duration, integrity results, owner, tested commit, rollback outcome, and approval.

Before legacy contraction, the restore must prove canonical counts, relationships, immutable histories, finance totals, assessment/result snapshots, and reporting rebuilds. A failed rehearsal blocks contraction.

Application rollback restores the preceding compatibility readers. Deprecated writers remain disabled once contraction is approved unless the product owner explicitly authorizes a separate emergency data-write plan.
