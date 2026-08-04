# 05 — Current Database Model Map

All persistence is MongoDB/Mongoose. There are 36 model files under `lib/db/models`; no migration directory or migration command exists.

## Identity, content and assessment

| Model | Key fields/relations | Assessment |
|---|---|---|
| `User` | identity, password, role, class, teacherDomain, charge usage, refresh hash, mixed AI profile | Overloaded; improve/split scopes and profiles |
| `Course` | bilingual titles, slug, level, subject, classes, teacher, price/status | Keep/migrate; duplicated language/source fields |
| `Video` | title, URL, target classes, teacher, published | Keep; add course/module/access relation |
| `VideoProgress` | student + video unique, seconds/percent/status | Keep |
| `CqAssignment` | title, classes, teacher, marks, due date | Incomplete without submissions/rubrics |
| `McqExam` | title, teacher, subject, duration, total/pass marks, classes, publish flags | Replace publish/version rules |
| `McqQuestion` | exam, four options, answer, marks/difficulty/topic/order | Replace with versioned question/reference model |
| `McqExamAttempt` | student/exam/session, answer correctness, score, percentage | Keep via immutable snapshot migration |
| `AttemptSession` | practice/exam, frozen question IDs, server timing/status | Strong foundation; keep/harden |
| `PracticeQuestion` | level/subject/chapter, answer, teacher/admin flags | Merge into unified question bank |
| `PracticeAttempt` | detailed answer snapshots, scores, teacher comment/delete flag | Keep history; remove hard-delete workflow |
| `PracticeResult` | latest/summary result by attempt | Redundant source of truth; derive/project deliberately |
| `PracticeSettings` | singleton timing/pass settings | Replace with versioned scoped configuration |
| `ReportedQuestion` | question/student/comment/resolved | Keep; add moderation actor/status/audit |
| `SyncedChapter` | level + subject + chapter unique | Temporary sync marker; merge with curriculum hierarchy |

## Learning, personalization and engagement

| Model | Purpose | Assessment |
|---|---|---|
| `StudentLearningProfile` | per-student plan/profile | Improve; avoid mixed/opaque recommendation truth |
| `StudentSubjectProgress` | subject XP/mastery/streak | Keep as projection, not canonical academic result |
| `SubjectProgressEvent` | progress events | Keep if made idempotent/auditable |
| `MistakeReview` | question review state and spaced interval | Keep |
| `StudentWeeklyGoal` | weekly target/progress/reward | Merge into learning plan |
| `StudentLabCompletion` | unique student/lab completion | Keep if science lab retained |
| `StudentCoachCheckIn` | coach prompt/recommendation | Retain with expiry/privacy policy |
| `StudentGameProfile` | XP/level/streak/cosmetics | De-emphasize; projection only |
| `StudentAchievement` | achievement code/unlock | Keep selectively |
| `StudentQuestClaim` | quest period claim | Product decision |
| `ClassMissionClaim` | class mission contribution | Product decision |
| `DailyChallenge` | date/class frozen question set | Merge under practice campaign |
| `DailyChallengeAttempt` | one attempt/student/challenge | Merge under assessment attempt |
| `FocusSession` | focus timer/reflection/reward | Product decision |
| `FormulaSprintAttempt` | five-card recall/confidence | Merge under revision attempt |
| `GamificationEvent` | idempotent practice XP reward | Keep as reward ledger if gamification remains |
| `PeerEncouragement` | class-scoped encouragement | Needs moderation/safeguarding |

## Infrastructure and telemetry

| Model | Purpose | Assessment |
|---|---|---|
| `ProductEvent` | allowlisted analytics, 180-day TTL | Keep; add metric/privacy catalog |
| `PushSubscription` | device/user Web Push endpoint/keys | Harden ownership, uniqueness and lifecycle |
| `AppInstall` | install/launch, user agent, IP | Minimize; define retention and consent |
| `RateLimitBucket` | Mongo fixed-window bucket with TTL | Keep short-term; monitor write amplification |

## Relationship summary

```text
User(student) -> AttemptSession -> PracticeAttempt / McqExamAttempt
User(teacher) -> Course / Video / CqAssignment / McqExam
McqExam -> McqQuestion -> McqExamAttempt.answers
PracticeQuestion -> PracticeAttempt.answers / MistakeReview / ReportedQuestion
User(student) -> progress, goals, focus, game, lab, coach, community projections
```

## Structural gaps

- No Organization, Branch, AcademicSession, Batch, Enrollment, TeacherAssignment, Guardian, Attendance, Routine, Invoice, Payment, AuditLog, Notification, CQSubmission, QuestionVersion, or ExamVersion.
- No durable branch key or tenant boundary on any collection.
- Practice and formal exams duplicate question and attempt concepts.
- Published content/question state is mutable and not versioned.
- `answers: [Object]` in `McqExamAttempt` and `PracticeAttempt` weakens schema validation.
- `McqExam` has no indexes and no schedule/attempt policy.
- `User.aiProfile` is `Mixed`, and `PracticeResult` duplicates academic outcome fields.
