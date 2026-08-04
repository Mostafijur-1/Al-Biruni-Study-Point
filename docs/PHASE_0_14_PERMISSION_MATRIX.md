# 14 — Proposed Role and Permission Matrix

Roles are assignable bundles; authorization decisions use permissions plus resource scope. No endpoint should branch only on a role string.

Legend: G = global organization, B = assigned branch, A = explicit academic assignment, O = own record/child, — = none.

| Capability | Super Admin | Branch Admin | Academic Admin | Accounts | Reception | Teacher | Assistant | Content Manager | Examiner | Student | Guardian |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Branch/config/security | G | B | — | — | — | — | — | — | — | — | — |
| Manage roles/permissions | G | B limited | — | — | — | — | — | — | — | — | — |
| Admission/student identity | G | B | B view | — | B | A view | A view | — | — | O | O child |
| Batch/enrollment | G | B | B | — | B create | A view | A view | — | — | O | O child |
| Routine/class sessions | G | B | B | — | B view | A | A assist | — | — | O | O child |
| Mark attendance | G | B approve | B approve | — | B view | A | A draft | — | — | O view | O child |
| Create questions/content | G | B | B | — | — | A | A draft | B | A draft | — | — |
| Approve questions | G | B | B | — | — | — | — | B | B | — | — |
| Build/publish exam | G | B | B | — | — | A draft | A draft | — | A publish | — | — |
| Evaluate/publish result | G | B | B | — | — | A evaluate | A draft | — | A moderate | O view | O child |
| Fee plan/invoice | G | B approve | — | B | B draft | — | — | — | — | O view | O child |
| Record/refund payment | G | B approve | — | B | B record | — | — | — | — | O view | O child |
| Payroll/expense | G | B | — | B | — | — | — | — | — | — | — |
| Send announcements | G | B | B | B finance | B intake | A | A draft | B content | A | O receive | O receive |
| Reports/export | G | B | B academic | B finance | B limited | A | A limited | Content only | A | O | O child |
| Audit log | G | B | B academic | B finance | Own actions | Own actions | Own actions | Own actions | Own actions | — | — |

## Policy primitives

- `organizationId` and `branchId` equality.
- Active role assignment with validity dates.
- Permission key, e.g. `assessment.exam.publish`.
- Resource scope: branch, batch, subject, assigned student, ownership, linked child.
- Record state: draft/published/voided/locked.
- Separation of duties for result publication, refunds and payroll.

## Implementation contract

```text
authorize(actor, action, resourceContext) -> allow/deny + scoped query
```

The result must be applied inside the database filter, not only after a record is loaded. Every sensitive denial and mutation must write a structured security/audit event. Default deny.
