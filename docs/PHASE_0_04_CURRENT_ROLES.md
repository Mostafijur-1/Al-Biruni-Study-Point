# 04 — Current Role Map

## Implemented identities

`types/index.ts:1` defines exactly three roles.

| Role | Creation | Approval | Current scope | Major gaps |
|---|---|---|---|---|
| `student` | Public registration | Immediate | Class-filtered learning/practice/exams and own results | No enrollment, batch, branch, guardian, fee or attendance scope |
| `teacher` | Public teacher application | Admin approval | Embedded `teacherDomain` classes/subjects/student IDs | No branch/batch assignment, permission set, examiner/content distinction |
| `admin` | Seed script/internal | N/A | Global access to admin routes | No branch or separation of academic/accounts/security duties |

## Enforcement today

- `proxy.ts` uses access-token role plus a JavaScript-readable role cookie for page routing.
- `requireAuth()` verifies the JWT, loads the user, checks active/teacher approval, and accepts an allowed-role array (`lib/auth/session.ts:55-92`).
- `lib/permissions.ts:3-31` defines 13 permissions, but `can()` has no callers. Therefore the system is not permission-based in practice.
- Teacher scope is an embedded object on `User`: `isAll`, class strings, subject strings, and student ObjectIds (`lib/db/models/User.ts:17-23,63-68`).
- Scope checks are duplicated in teacher MCQ and result routes and are not consistently applied to exams, courses, videos, CQ, broadcasts, or formal-result reads.

## Effective access matrix

| Capability | Admin | Teacher | Student |
|---|---:|---:|---:|
| Manage users/teacher approval | Yes | No | No |
| Configure teacher domain | Yes | No | No |
| View/create own courses/videos/CQ | Yes/global create | Yes/creator list | Published class-filtered view |
| Manage practice questions | Global | Domain + creator/reported-question logic | Take/report |
| Create formal exams | No UI/API role | Yes, without domain validation | No |
| Read formal exam results | Any examId | Any examId (gap) | Own, published |
| Read practice results | Admin global | Embedded domain | Own summary |
| Delete results | Global hard delete | Scoped hard delete | No |
| Broadcast push | Yes | Global/target-class (gap) | No |
| Product analytics events | No | No | Own allowlisted events |

## Role risks

1. Role names conflate job titles and permissions.
2. A teacher with one assigned student can create an exam for any subject/class; teacher-domain enforcement is absent from exam creation.
3. A teacher can query formal results for an arbitrary exam ID in `app/api/mcq/results/route.ts:144-155`.
4. Branch isolation is impossible because no record carries organization/branch ownership.
5. Embedded student arrays will become large, difficult to audit, and awkward to preserve historically.

Target roles and policies are defined in `PHASE_0_14_PERMISSION_MATRIX.md`.
