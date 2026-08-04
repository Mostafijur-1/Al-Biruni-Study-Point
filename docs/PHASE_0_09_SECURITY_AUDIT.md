# 09 — Security Audit

## Confirmed strengths

- Passwords use bcrypt cost 12.
- Access and refresh JWTs use separate ≥32-character secrets and HS256.
- Access/refresh cookies are HttpOnly, Secure in production, SameSite=Lax, path `/`.
- Refresh tokens are rotated and a hash is stored server-side.
- `requireAuth()` reloads user active/approval state on API access.
- Login and registration are rate-limited in MongoDB.
- Image uploads check size, MIME and file signature before Cloudinary.
- Live headers include CSP, HSTS, X-Content-Type-Options, frame denial, Referrer-Policy and Permissions-Policy.
- Exam/practice questions omit correct answers before submission and use server timing.

## Findings

| Severity | Finding and evidence | Exploit/impact | Required control |
|---|---|---|---|
| P0 critical | Teacher formal-result listing has no exam ownership check (`app/api/mcq/results/route.ts:144-155`) | Any approved teacher who knows/obtains an exam ID can read students/results/answers for another teacher | Policy filter `exam.teacher = actor`, plus batch/subject assignment; regression test |
| P0 critical | Formal-result detail allows any teacher (`app/api/mcq/results/[id]/route.ts:24-38`) | Cross-teacher access to student identity and full solutions | Ownership/scope policy on GET |
| P0 critical | Teacher practice-result DELETE wipes the chosen attempt, summary, and every attempt for subject (`teacher/results/[id]/route.ts:90-103`) | Irrecoverable academic data loss | Disable route; introduce void/correction with audit |
| P0 high | Teacher exam creation/publish does not validate `teacherDomain`; publish has no question/mark invariant | Unauthorized subject/class exams and incorrect results | Central teacher assignment policy + publish transaction/invariants |
| P0 high | Cron secret is optional (`cron/evening-reminder/route.ts:30-33`) | Missing env makes mass notification endpoint public | Require secret in production; POST only; Vercel cron signature/secret |
| P0 high | Any teacher can broadcast to all subscriptions (`admin/broadcast/route.ts:22-53`) | Spam/privacy/operational abuse outside assigned students | Separate `notification:send` permission + branch/batch recipient scope + audit/approval |
| P1 high | Teacher bulk MCQ delete removes reports for every supplied ID, even questions not deleted | A teacher can erase moderation reports on others’ questions | Delete reports only for actually deleted owned IDs; audit |
| P1 high | Guest video list returns serialized records containing `videoUrl` | Published learning media can be enumerated without enrollment/login | Public previews separate from private asset URL; signed delivery |
| P1 medium | Public PWA subscribe/track have ad hoc validation, no rate limit; deviceId is client-controlled | Storage abuse, device collision, telemetry poisoning | Zod, limits, endpoint hash uniqueness, ownership challenge, retention |
| P1 medium | AppInstall stores IP and user agent with no TTL/consent documentation | Privacy/retention exposure | Minimize/anonymize IP; TTL and privacy notice |
| P1 medium | No audit log for approvals, scope changes, result comments/deletes, publish or broadcasts | Weak accountability and incident response | Immutable AuditLog with actor/resource/before-after/request ID |
| P1 medium | Refresh rotation has a single stored token hash | Concurrent devices invalidate one another; no device/session revocation model | Session collection with token family, device, expiry and revocation |
| P1 medium | CSP allows `'unsafe-inline'` scripts/styles | Reduces XSS defense depth | Nonce/hash CSP where compatible; remove inline styles/scripts incrementally |
| P1 medium | No password reset, account lock/progressive delay, session list, or suspicious login log | Account recovery/support and incident response gaps | Add secure recovery and session management |
| P2 | Public self-service teacher registration | Spam/identity verification burden | Invitation/application verification and stronger throttling |
| P2 | Error logging is unstructured and may include provider response text | Potential sensitive-data leakage in logs | Redaction + structured logger |

## Data isolation conclusion

The current system cannot satisfy branch isolation because organization and branch do not exist in schemas. Adding more roles before tenant keys and scoped policy queries would create false security.

## Verification limits

No destructive or cross-account action was executed against live data. Findings are confirmed through reachable code paths. Dependency vulnerabilities were not asserted because npm advisory access was not approved.
