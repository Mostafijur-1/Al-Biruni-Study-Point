# 16 — Proposed Service and API Architecture

## Boundaries

```text
Route handler / server action
  -> authentication + request parsing
  -> authorization policy (returns scoped context/query)
  -> application service / workflow
  -> repositories + transaction/outbox
  -> typed response mapper
```

UI components never decide sensitive access. Mongoose models should not be imported into client code or scattered across new route handlers.

## Shared primitives

- `RequestContext`: request ID, actor, organization, branch, locale/timezone.
- `Policy`: permission + assignment + ownership + record-state checks.
- `DomainError`: stable code, safe Bangla message key, HTTP mapping, retry hint.
- `PageQuery`: cursor/limit/filter/sort validation.
- `AuditWriter`: actor/action/resource/before-after/reason/request ID.
- `IdempotencyService`: required for payment, attendance batch mark, result publish and submissions.
- `Outbox`: notification and analytics side effects after successful transactions.

## Workflow APIs

Prefer workflow contracts over arbitrary CRUD:

- `POST /api/v2/batches/{id}/attendance-sheets` — open/mark class attendance.
- `POST /api/v2/attendance-sheets/{id}/submit` — finalize with idempotency key.
- `POST /api/v2/exams/{id}/publish` — validate and freeze version.
- `POST /api/v2/exam-attempts/{id}/responses:save` — delta autosave.
- `POST /api/v2/exam-attempts/{id}/submit` — idempotent authoritative submit.
- `POST /api/v2/results/{id}/publish` and `/void` — audited state changes.
- `POST /api/v2/students/{id}/enrollments` and `/transfers`.
- `POST /api/v2/invoices/{id}/payments` — allocate immutable payment.
- `POST /api/v2/guardians/{id}/children:link` — verified linking.

## Response convention

```json
{
  "success": false,
  "error": {
    "code": "ASSESSMENT_ALREADY_SUBMITTED",
    "message": "এই পরীক্ষাটি ইতিমধ্যে জমা দেওয়া হয়েছে।",
    "requestId": "...",
    "details": {}
  }
}
```

Do not expose provider/database errors. Validation details should identify fields using stable codes.

## Transition approach

- Keep `/api/*` contracts working through adapters while adding `/api/v2` only where breaking changes are necessary.
- First extract policies/services behind existing handlers; do not start with a route-wide rewrite.
- Generate typed client contracts from shared schemas or an OpenAPI document.
- Add integration tests for every policy/action pair before removing legacy checks.
