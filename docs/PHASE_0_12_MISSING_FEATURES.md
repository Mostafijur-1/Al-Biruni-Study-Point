# 12 — Missing-Feature Report

Missing does not mean “build now.” Priority reflects prerequisites and actual coaching-center value.

| Capability | Current evidence | Priority | Recommendation |
|---|---|---:|---|
| Organization/branch isolation | No model/key/policy | P0 foundation | Add before multi-role operational data |
| Audit log | No model/service | P0 | Required for sensitive mutations |
| Migration framework | No scripts/ledger | P0 | Required before schema refactor |
| Exam version/publish invariants | Mutable exam/questions | P0 | Freeze reproducible assessment snapshots |
| Attendance | No model/route/page | P1 | Build after batch/session/assignment |
| Academic session/program/class/group/subject hierarchy | Static unions/maps | P1 | Canonical academic structure |
| Batch/enrollment/teacher assignment | API placeholders/embedded student arrays | P1 | Core academic operations |
| Routine/class session | None | P1 | Needed for attendance and teacher dashboard |
| CQ submission/evaluation | Placeholder | P1 | Complete end-to-end or hide |
| Admission/student lifecycle | Public registration only | P1 | Inquiry → admission → enrollment/status history |
| Fees/invoice/payment/receipt | None; teacher charge is unrelated | P1 | Ledger-backed workflow after identity/batch |
| Guardian identity/linking | No role/model | P2 | Secure multi-child portal after core data |
| Notification preferences/templates/log | Raw Web Push only | P2 | Targeted, auditable communication |
| Reports/export | Limited UI views | P2 | Permission-scoped, metric-defined reports |
| Assignment rubric/submission/versioning | Assignment header only | P2 after CQ core | Expand coherently |
| File ownership/private delivery | Cloudinary URL only | P1/P2 | Asset metadata, access policy, signed URLs |
| Password reset/session/device management | Missing | P0/P1 | Auth hardening |
| Observability | Health + console logs only | P1 | Structured logs, request IDs, error tracking |
| Backup/restore/staging | Documentation only | P1 | Operational readiness |
| Accessibility test automation | None | P1 | Axe/browser checks plus manual Bangla SR QA |
| AI tutor/personalized planner | Rule coach only | P3 | Do not implement before approved content and privacy controls |
| Advanced science lab content | 18 formula simulations, no biology | P3 | Improve pedagogy/framework later, not breadth now |
| Library/inventory/transport/hostel | None | Product decision | Validate coaching-center need; disabled modularly |

## Explicit non-recommendations for the next phase

Do not add payroll, full accounting, public leaderboards, advanced AI tutor, more gamification, new simulations, transport, hostel, or native apps while P0/P1 foundations remain unresolved.
