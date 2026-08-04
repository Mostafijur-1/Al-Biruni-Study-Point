# Phase 1 session and API error contract

## Session behavior

- ABSP uses one current session per user. A successful sign-in replaces the previous session.
- Access and refresh tokens carry the user's `sessionVersion`. API authorization compares that version with the current user record.
- A successful logout removes the stored refresh-token hash and increments `sessionVersion`, invalidating outstanding access tokens at the API boundary.
- Refresh-token rotation uses a compare-and-swap update on both the stored token hash and session version. Only one request can rotate a given refresh token.
- Logout first verifies that the presented refresh token matches the current stored token. An older, otherwise valid signed token cannot terminate a newer session.
- API role checks use the current database role, not only the role embedded in an access token. The route proxy remains a navigation convenience; API authorization is the security boundary.
- Existing users and legacy tokens are treated as session version `0`. The model field is additive and defaults to `0`, so this change does not require a destructive migration.

## API failure envelope

Every response created by `fail()` keeps the existing envelope and adds a stable code and request identifier:

```json
{
  "success": false,
  "error": {
    "message": "Invalid session.",
    "code": "UNAUTHENTICATED",
    "requestId": "2fe2e752-04d0-4fca-bb72-44d32409bb64"
  }
}
```

The same identifier is returned in the `X-Request-ID` response header. Clients may continue using `message` and `details`; the new fields are backward-compatible additions. Client diagnostics log the request identifier so a reported failure can be matched to server logs.

Default status mappings are:

| HTTP status | Error code |
| --- | --- |
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `CONFLICT` |
| 410 | `GONE` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 422 | `VALIDATION_ERROR` |
| 429 | `RATE_LIMITED` |
| 503 | `SERVICE_UNAVAILABLE` |
| Other 5xx | `INTERNAL_ERROR` |

Schema-validation failures use `VALIDATION_ERROR` even when returned with HTTP 400. Unhandled server errors expose no exception detail to the client and are logged with the same request identifier.
