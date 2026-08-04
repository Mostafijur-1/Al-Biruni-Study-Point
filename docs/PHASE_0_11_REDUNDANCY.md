# 11 — Redundancy Report

| Redundancy | Evidence | Decision |
|---|---|---|
| Practice vs formal question models | `PracticeQuestion` and `McqQuestion` duplicate options/answer/explanation | Merge behind versioned question bank; keep compatibility adapters |
| Practice summary vs attempt truth | `PracticeResult` duplicates score/time/status from `PracticeAttempt` | Define attempt as truth; summary as rebuildable projection |
| Subject aliases in type/data/query logic | English and Bangla variants in `CourseSubject` and repeated mapping | Canonical Subject ID + Bangla display name + aliases at import boundary |
| Dead bilingual runtime | `next-intl` unused; locale ternaries remain; only `bn` dictionary | Remove dependency and conditional branches after copy QA |
| Static vs database courses/batches | Public catalog/dictionary and Mongo models diverge | One published offering read model |
| Admin overview vs analytics | Both render `AdminOverview` | Remove `/admin/analytics` or make it a real reporting workspace later |
| Admin settings vs MCQ manager | `/admin/settings` redirects to `/admin/practice-mcqs` | Rename route now; reserve settings for real config |
| Teacher result components | `TeacherResultsDashboard` and `TeacherMcqResults` overlap result/comment/delete UI | Consolidate shared result review surface |
| Question managers | Admin and teacher managers repeat upload/edit/forms | Shared question editor/import pipeline with permission-specific actions |
| Engagement destinations | Game, challenge, goals, focus, formulas, coach, community are separate top-level items | Merge into learning/practice/progress; feature-flag secondary tools |
| Homepage and dedicated public sections | Home repeats course/batch/tutor content | Keep summaries on home, canonical detail routes from one data source |
| Documentation | README/PRD/ARCHITECTURE describe removed locale layout and unimplemented infra | Replace with current architecture + ADRs |

Redundancy removal must be behavior-preserving: add aliases/redirects and rebuildable projections before deleting collections or routes.
