# 15 — Proposed Database Architecture

Retain MongoDB/Mongoose. Normalize operational relationships; embed immutable snapshots where read consistency requires it.

## Core bounded contexts

| Context | Target entities |
|---|---|
| Tenancy/identity | `Organization`, `Branch`, `User`, `UserSession`, `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`, `AuditLog` |
| People | `StudentProfile`, `GuardianProfile`, `StudentGuardian`, `EmployeeProfile`, `TeacherProfile` |
| Academic | `AcademicSession`, `Program`, `ClassLevel`, `Group`, `Subject`, `Chapter`, `Topic`, `Batch`, `BatchEnrollment`, `TeacherAssignment`, `Classroom`, `RoutineSlot`, `ClassSession` |
| Attendance | `AttendanceSheet`, `AttendanceRecord`, `AttendanceCorrection` |
| Learning | `Course`, `CourseModule`, `LearningMaterial`, `Video`, `VideoProgress`, `Assignment`, `AssignmentSubmission`, `TeacherFeedback` |
| Assessment | `Question`, `QuestionVersion`, `QuestionTag`, `Exam`, `ExamVersion`, `ExamSection`, `ExamVersionQuestion`, `AttemptSession`, `ExamAttempt`, `ExamResponse`, `ResultPublication` |
| Practice/progress | `PracticePlan`, shared `AssessmentAttempt`, `MistakeReview`, `MasteryProjection`, `LearningRecommendation` |
| Finance | `FeeType`, `FeePlan`, `StudentFeeAssignment`, `Invoice`, `InvoiceLine`, `Payment`, `PaymentAllocation`, `Adjustment`, `Discount`, `Expense`, `Receipt` |
| Communication | `Announcement`, `Notification`, `NotificationDelivery`, `NotificationPreference`, `PushSubscription`, `Template` |
| Science/engagement | `ScienceExperiment`, `ExperimentVersion`, `ExperimentCompletion`; optional reward projections |

## Key modeling rules

1. Every operational record carries `organizationId`; branch-owned records also carry `branchId`.
2. Published questions/exams reference immutable versions. Attempts embed the exact prompt/options/rules necessary to reproduce results.
3. Academic results, attendance changes, invoices, payments and allocations are never hard-deleted; use status/reversal/correction records.
4. Enrollment, teacher assignment, fee assignment and guardian links use effective dates to preserve history.
5. Canonical subjects/chapters use stable IDs and one Bangla display name; import aliases handle legacy English/Bangla strings.
6. Denormalized counters are explicitly labeled projections and rebuildable.
7. All money uses integer minor units (poisha) or a documented decimal strategy; never floating-point arithmetic.

## Initial indexes

| Query | Index |
|---|---|
| User login | unique sparse normalized phone/email within organization |
| Enrollment roster | `{ branchId, batchId, status, studentId }` + uniqueness for active enrollment |
| Teacher workload | `{ teacherId, academicSessionId, status }` |
| Attendance sheet | unique `{ classSessionId }`; record unique `{ sheetId, studentId }` |
| Exam eligibility | `{ examVersionId, batchId }`; attempt unique by policy key |
| Question filters | `{ subjectId, chapterId, topicId, type, difficulty, status }` |
| Student results | `{ studentId, submittedAt: -1 }` |
| Invoice/due report | `{ branchId, studentId, dueDate, status }` |
| Payment ledger | `{ branchId, paidAt: -1 }`, unique idempotency key |
| Notifications | `{ recipientId, status, createdAt: -1 }` |
| Audit | `{ organizationId, resourceType, resourceId, createdAt: -1 }`, `{ actorId, createdAt: -1 }` |

Create indexes only with measured query evidence and migration-safe background rollout.

## Legacy-to-target mapping

- `User` → `User` plus role assignments and student/teacher profiles; retain legacy role during dual-read.
- `teacherDomain.students/classes/subjects` → `TeacherAssignment`/batch enrollment scope.
- `PracticeQuestion` + `McqQuestion` → `Question`/`QuestionVersion` with legacy source IDs.
- `McqExam`/questions → `Exam`/`ExamVersion`/version questions.
- `PracticeAttempt`, `PracticeResult`, `McqExamAttempt` → common immutable attempt/result read model; preserve source IDs.
- Engagement collections remain projections until product decisions are approved.
