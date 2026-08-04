# 13 — Proposed Information Architecture

Navigation is task-based and permission-filtered; database entities remain behind workflows.

## Student

| Top level | Contents |
|---|---|
| হোম | আজকের ক্লাস/কাজ, next best action, due exam/assignment, relevant alert |
| শেখা | Subjects, chapters/topics, recorded class, materials, continue learning |
| Practice | General/teacher practice, ভুলের খাতা, formula revision, daily challenge |
| পরীক্ষা | Upcoming/formal exams, active attempt, results when published |
| কাজ | Assignment/homework/CQ submission and feedback |
| অগ্রগতি | Mastery, own trend, attendance, goals; no public rank by default |
| আরও | Profile, science lab, focused study, community if enabled |

The game hub is not top-level. XP/streak can appear as a quiet progress cue only when connected to a real learning action.

## Teacher

| Top level | Contents |
|---|---|
| Dashboard | Today’s classes, attendance action, pending review, student alerts |
| Batch ও শিক্ষার্থী | Assigned batches/students, academic profile, notes |
| Attendance | Fast class-session marking, corrections with permission |
| পরীক্ষা | Question bank, exam builder, publish, evaluation, results |
| Assignment | Create, submissions, rubrics, feedback |
| ক্লাস ও রিসোর্স | Recorded class, materials, syllabus coverage |
| Analytics | Batch/topic/attendance/submission insights |
| যোগাযোগ | Assigned-recipient announcements only |

## Admin/staff

| Group | Modules |
|---|---|
| Overview | Action queue, operational KPIs with defined freshness |
| Academic | Session, program/class/subject, batch, routine, teacher assignment |
| People | Admission, students, guardians, employees |
| Attendance | Daily exceptions, correction approvals, reports |
| Assessment | Question/content review, exam moderation, result publication |
| Fees ও Accounts | Fee plans, invoices, payments, receipts, dues, expenses |
| Communication | Announcement templates, recipient scope, delivery status |
| Reports | Academic/attendance/finance reports and exports |
| Configuration | Branch, permissions, academic calendar, integrations |
| Security ও Audit | Sessions, audit events, sensitive actions |

## Public

`Home → Programs/Courses → Batches → Admission/Contact → FAQ/About`. All pages must use a single published offering source. Hide course detail/FAQ/About until content is real; remove placeholder pages from sitemap in the interim.

## Route transition

- Keep current URLs as redirects/aliases during migration.
- Merge `/student/game`, `/challenge`, `/formulas`, `/goals`, `/focus`, and `/mistakes` into contextual tabs without deleting their data.
- Replace `/teacher` redirect with a dashboard.
- Rename `/admin/practice-mcqs` to `/admin/assessment/questions`; redirect old URL.
- Remove duplicate `/admin/analytics` after report workspace exists.
- Reserve `/admin/settings` for actual configuration.
