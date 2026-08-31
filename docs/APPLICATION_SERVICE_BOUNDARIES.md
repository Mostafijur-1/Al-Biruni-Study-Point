# Application service boundaries

Step 4 establishes one request flow for high-risk modules:

```text
route adapter -> request context -> application service -> policy -> scoped repository -> Mongoose model
```

## Responsibilities

- Route adapters authenticate, parse input, construct `RequestContext`, invoke one application service, and map the result to the existing HTTP response.
- Application services own workflow decisions, authorization checks, idempotency, audit events, and orchestration.
- Repositories own query construction and apply the canonical organization, branch, and academic-session scope before resource filters.
- Domain errors preserve the existing API error envelope through `ApiRouteError`.
- Multi-document enrollment changes use the shared MongoDB transaction wrapper.

The first migrated modules are enrollment, written exams, student reports, and finance. Their external response shapes and status codes remain compatible.

## Idempotency contract

Mutation clients may send an `Idempotency-Key` header. Keys are isolated by actor, workflow, and target. Reusing a key with a different payload returns `IDEMPOTENCY_KEY_REUSED`; a completed request replays its stored response. Records expire after 24 hours.

If the business write succeeds but replay-result persistence fails, the record remains in `started` state and retries fail closed. Operators should investigate rather than delete such a record and risk replaying a committed mutation.

## Policy matrix

| Actor | Resource access |
| --- | --- |
| Admin | Any resource within the selected canonical scope |
| Assigned teacher | Resources linked to an active assignment |
| Unassigned teacher | Denied |
| Owner student | Own enrolled/published resource |
| Unrelated student | Denied |

## Repository rule

New route handlers in migrated modules must not import database models or construct Mongoose queries. New repository methods must begin with `canonicalScopeFilter(context.scope)` for every scope-aware collection.

## Rollback

The route adapters preserve the original HTTP contract, so an emergency rollback can restore the preceding route implementation without a data migration. Keep `ApplicationIdempotency` records and newly added optional finance scope fields; they are backward compatible.
