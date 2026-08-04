# Phase 3 attendance acceptance matrix

Status: design-only release criteria. No row authorizes implementation or rollout.

Every runtime row requires automated evidence unless marked manual. Database workflow evidence must use a disposable transaction-capable MongoDB environment. Browser evidence must be authenticated and cover the same commit proposed for rollout.

| ID | Given | When | Then | Required evidence |
|---|---|---|---|---|
| G-01 | Phase 2 evidence is absent, invalid, or stale | Phase 3 implementation eligibility is checked | Eligibility fails closed and no attendance write flag is enabled | Readiness contract test |
| G-02 | Phase 2 evidence is valid but explicit Phase 3 approval is absent | Eligibility is checked | Attendance remains locked | Readiness contract test |
| D-01 | A canonical eligible class session and effective roster exist | An assigned teacher opens attendance twice | One sheet and one roster snapshot exist; the second response returns the same sheet | Replica-set integration test |
| D-02 | A student joins after the class start | The historical sheet opens | The student is not silently added | Policy unit test and DB integration test |
| D-03 | A student transfers after the class start | The historical sheet is read later | The original enrollment remains explainable in the frozen roster | DB integration test |
| D-04 | An unmarked roster exists | Submit is requested | Submission fails with `ATTENDANCE_UNMARKED_STUDENTS` and no partial write | Transaction integration test |
| D-05 | A complete draft exists | Submit succeeds | The sheet becomes immutable and all records, audit, idempotency result, and outbox event commit together | Transaction integration test |
| D-06 | Any transaction participant fails | Submit is attempted | Sheet, records, audit, idempotency result, and outbox remain uncommitted | Injected-failure integration test |
| C-01 | Two clients hold the same version | One writes and the other writes stale data | The stale write receives `ATTENDANCE_VERSION_CONFLICT`; no mark is lost | Concurrency integration test |
| C-02 | The roster changes while a draft is open | A draft write or submit uses the old roster version | The server returns `ATTENDANCE_ROSTER_CHANGED`; it never silently rewrites membership | Integration test |
| I-01 | A submit request has an idempotency key | The identical request is retried | The original result is returned and only one audit/outbox result exists | Integration test |
| I-02 | An idempotency key was already used | A different payload reuses it | The server returns `IDEMPOTENCY_KEY_REUSED` without mutation | Integration test |
| A-01 | A teacher is assigned to the exact class session | The teacher reads and marks its draft | Access succeeds within organization, branch, batch, subject, and assignment scope | Policy and API integration tests |
| A-02 | A teacher belongs to another assignment, branch, or organization | The teacher guesses a sheet ID | Access fails under the non-enumerating policy and no data leaks | Negative API integration test |
| A-03 | An admin is outside the sheet's organization or branch scope | The admin requests it | Access fails before any mutation or audit detail is disclosed | Negative API integration test |
| A-04 | A student requests attendance | The own endpoint responds | Only that student's submitted, student-safe projection is returned | API integration test |
| A-05 | A student requests a draft, peer, note, or correction reason | The request is evaluated | The resource is withheld and existence is not leaked | Negative API integration test |
| R-01 | A submitted record is wrong | Its assigned teacher requests a reasoned correction | An append-only pending correction is created; the sheet is not reopened | Integration test |
| R-02 | An actor requested a correction | The same actor attempts approval | Approval is forbidden | Policy and API integration tests |
| R-03 | An in-scope admin approves a correction | Approval commits | Before/after values, actors, reason, sequence, audit, and outbox event are retained atomically | Transaction integration test |
| R-04 | An approved correction request is retried | The same idempotency key and payload are sent | The original correction result returns without a duplicate sequence | Integration test |
| P-01 | Submitted records contain present, late, absent, and excused values | Attendance is calculated | Present and late are attended, absent is denominator-only, and excused is excluded | Pure policy unit test |
| P-02 | Every submitted value is excused | Attendance is calculated | Percentage is unavailable and no divide-by-zero or misleading percentage appears | Unit and UI tests |
| P-03 | A historical sheet has a policy snapshot | Organization policy changes later | Historical calculations remain unchanged | Unit and integration tests |
| E-01 | A sheet is submitted | The transaction commits | Exactly one replay-safe outbox event contains identifiers and counts but no private notes | Integration test and payload snapshot |
| E-02 | A consumer is unavailable | Submission commits | Attendance remains authoritative and the outbox retains the event for retry | Integration test |
| U-01 | A teacher uses a supported mobile width | The teacher marks a typical roster using bulk present plus exceptions | The flow is operable one-handed, exposes 44-pixel targets, and requires review before submit | Authenticated manual browser evidence |
| U-02 | A keyboard-only teacher uses desktop | The teacher opens, marks, reviews, and submits | Focus order is predictable, focus is visible, and every action is keyboard operable | Authenticated manual browser evidence |
| U-03 | A screen reader is active | Statuses, bulk changes, errors, conflicts, and submit results occur | Each is announced with student/class context and without color-only meaning | Authenticated manual screen-reader evidence |
| U-04 | The network response is lost after a successful submit | The client retries | The same key is reused, the confirmed result appears once, and the UI does not offer another submit | Browser/API integration test |
| U-05 | The client is offline | A teacher attempts mutation | No offline-write promise is made; pending local UI is clearly distinguished and server reconfirmation is required | Browser test |
| X-01 | A cross-scope ID, private note, or student identifier exists | Logs, metrics, and error bodies are inspected | No sensitive value appears outside approved audit storage | Log-capture and API tests |
| X-02 | Attendance writes are disabled | Any attendance mutation is requested | The server fails closed while safe authorized reads follow rollout policy | Configuration integration test |
| O-01 | A pilot branch is enabled | Attendance traffic runs | Latency, retry, conflict, correction, transaction, and outbox-lag metrics are available without PII | Staging observability evidence |
| O-02 | Rollback is invoked | New writes and consumers stop | Submitted history, corrections, audits, idempotency results, and outbox records remain intact | Staging rollback drill |

## Release evidence bundle

The eventual Phase 3 evidence artifact must identify the exact commit and contain:

- migration dry-run/apply/rollback reports and index verification;
- unit, policy, API, transaction, concurrency, and replay test results;
- authenticated admin, teacher, and student journeys at mobile and desktop widths;
- keyboard, screen-reader, zoom/reflow, reduced-motion, and Bangla copy review;
- cross-tenant and assignment-scope negative-test results;
- pilot metrics, correction sampling, outbox replay, and rollback-drill references;
- named security, academic-operations, accessibility, and rollout approvals.

The bundle is invalid if it contains placeholders, refers to another commit, omits a modality, or treats a green CI job as business rollout approval.

The machine-verifiable artifact and read-only validation workflow are defined in `PHASE_3_ATTENDANCE_RELEASE_GATE.md`. A valid artifact permits only a separately approved named-branch pilot; it never enables attendance writes itself.
