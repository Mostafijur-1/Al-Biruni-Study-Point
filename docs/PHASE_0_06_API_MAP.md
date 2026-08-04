# 06 — Current API Map

Authentication is enforced by `requireAuth(request, [roles])` unless marked public. Responses are mostly `{ success, data }` / `{ success, error }` via `lib/api/response.ts`; placeholders return a different bare shape.

## Authentication and profile

| Method and path | Access | Purpose |
|---|---|---|
| `POST /api/auth/register` | Public, rate-limited | Create and sign in student |
| `POST /api/auth/register/teacher` | Public, rate-limited | Create pending teacher |
| `POST /api/auth/login` | Public, rate-limited | Verify credential, rotate stored refresh hash |
| `GET/POST /api/auth/refresh` | Refresh cookie | Rotate session/redirect |
| `GET/PATCH /api/auth/me` | Any signed-in role | Session/profile read/update |
| `POST /api/auth/logout` | Cookie optional | Revoke stored refresh hash and clear cookies |

## Catalog, learning and CQ

| Method and path | Access | Purpose/finding |
|---|---|---|
| `GET/POST /api/courses` | Guest/student/admin/teacher by scope | List/create courses; teachers target any class |
| `GET /api/admin/courses` | Admin | Course/question summary |
| `GET/POST /api/videos` | Guest/student/admin/teacher by scope | List/create videos; guest response includes stored URL |
| `GET/POST /api/learning/videos/[id]/progress` | Student | Read/write progress |
| `GET /api/learning/plan` | Student | Daily plan |
| `GET /api/learning/mastery` | Student | Mastery projection |
| `GET/POST /api/learning/mistakes` | Student | Review queue and answer |
| `GET/POST /api/cq/assignments` | Guest/student/admin/teacher | List/create CQ assignment |
| `POST /api/cq/submit` | Public handler | 501 placeholder |
| `GET /api/enrollments` | Public handler | 501 placeholder |
| `GET /api/batches` | Public handler | 501 placeholder |

## Practice and question bank

| Method and path | Access | Purpose |
|---|---|---|
| `GET/POST /api/mcq/practice/start` | Student | Build and begin frozen practice session |
| `POST /api/mcq/practice/submit` | Student, rate-limited | Validate session, score, save result/projections |
| `GET /api/mcq/practice/status` | Student | Subject/chapter/last result status |
| `POST /api/mcq/practice/report` | Student | Report question |
| `GET/DELETE /api/teacher/mcqs` | Teacher | List scoped bank / bulk delete own questions |
| `PUT/DELETE /api/teacher/mcqs/[id]` | Teacher | Edit/delete own or reported scoped question |
| `POST /api/teacher/mcqs/upload` | Teacher, rate-limited | AI text/image ingestion |
| `GET /api/teacher/mcqs/search` | Teacher | Domain-filtered search, max 50 |
| `GET/PUT /api/teacher/reports` | Teacher | List/resolve reports |
| `GET /api/teacher/subjects` | Teacher | Derived allowed subjects/chapters |
| `GET/PATCH/DELETE /api/admin/teacher-mcqs` | Admin | Review/bulk approve/delete |
| `PUT/PATCH/DELETE /api/admin/teacher-mcqs/[id]` | Admin | Edit/approve/delete question |
| `POST /api/admin/practice-mcqs/upload` | Admin | AI text/image ingestion |
| `GET/PUT /api/admin/practice-settings` | Admin | Global timing/pass settings |
| `GET /api/admin/practice-attempts/[studentId]/[subject]/wrong` | Admin | Wrong answers for student/subject |

## Formal exams and results

| Method and path | Access | Purpose/finding |
|---|---|---|
| `GET/POST /api/teacher/exams` | Teacher | List/create own exams; no teacher-domain validation |
| `GET/PUT/DELETE /api/teacher/exams/[id]` | Owning teacher | Read/update/hard-delete exam/questions/attempts |
| `POST/DELETE /api/teacher/exams/[id]/questions` | Owning teacher | Add/remove questions |
| `POST /api/teacher/exams/[id]/publish` | Owning teacher | Toggle exam/results without invariant checks |
| `GET /api/mcq/exams` | Student | List assigned teacher’s published class exams |
| `GET/POST /api/mcq/exams/[id]/start` | Student | Create/resume/begin server-timed session |
| `POST /api/mcq/exams/[id]/submit` | Student, rate-limited | Idempotent scoring/submission |
| `GET /api/mcq/results` | Student/teacher/admin | Own results or arbitrary examId for teacher/admin |
| `GET/PUT/DELETE /api/mcq/results/[id]` | Student/teacher/admin by method | Detail/comment/hard-delete; teacher GET lacks ownership check |
| `GET /api/teacher/results` | Teacher scope | Paginated practice results |
| `PUT/DELETE /api/teacher/results/[id]` | Teacher scope/admin | Comment or destructive subject-history wipe |

## Engagement and student support

| Method and path | Access | Purpose |
|---|---|---|
| `GET/POST /api/goals`, `POST /api/goals/claim` | Student | Weekly goals/reward |
| `GET/POST /api/coach`, `POST /api/coach/launch` | Student | Check-in, recommendation, launch event |
| `GET /api/challenge`, `POST /api/challenge/start`, `POST /api/challenge/submit` | Student | Daily challenge lifecycle |
| `GET /api/focus`, `POST /api/focus/start`, `/complete`, `/cancel` | Student | Focus session lifecycle |
| `GET /api/formulas`, `POST /api/formulas/start`, `/submit` | Student | Formula sprint lifecycle |
| `GET /api/gamification/profile`, `/hub` | Student | Game/profile projections |
| `POST /api/gamification/customize`, `/quests/claim` | Student | Equip reward / claim quest |
| `GET /api/community`, `POST /api/community/encourage`, `/mission/claim` | Student | Class community actions |
| `GET /api/labs`, `POST /api/labs/complete` | Student | Science lab hub/completion |

## Administration, notifications and platform

| Method and path | Access | Purpose/finding |
|---|---|---|
| `GET /api/admin/users` | Admin | Paginated/filtered users |
| `PATCH /api/admin/users/[id]` | Admin | Active/approval/domain/charge update |
| `GET /api/admin/overview` | Admin | Dashboard aggregates |
| `POST /api/admin/broadcast` | Admin or teacher | Global/class push; teacher scope not enforced |
| `POST /api/upload` | Admin or teacher | Cloudinary validated images |
| `POST /api/pwa/subscribe` | Public | Upsert subscription by client deviceId; no rate limit/Zod |
| `POST /api/pwa/track` | Public | Store install/launch, UA and IP; no rate limit/Zod |
| `GET/POST /api/cron/evening-reminder` | Public when `CRON_SECRET` missing | Send reminder push |
| `POST /api/analytics/events` | Student, rate-limited | Allowlisted product event |
| `GET /api/health` | Public | Database ping |

## API-wide findings

- Workflow naming is emerging (`start`, `submit`, `publish`, `claim`, `complete`) and should be retained.
- Zod usage is strong but not universal; notification/PWA endpoints use ad hoc checks.
- ObjectId validation is inconsistent; invalid IDs often become generic 500 responses.
- Pagination is inconsistent; courses/videos cap at 100, teacher questions can be unbounded, and results vary.
- Sensitive mutations have no shared audit-log write.
- No idempotency key exists for future financial operations; exam/practice idempotency relies on unique records/session IDs.
- Three placeholder APIs expose unfinished contracts in production.
