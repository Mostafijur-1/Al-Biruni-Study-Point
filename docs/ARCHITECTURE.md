# ABSP Software Architecture

ABSP - Al-Biruni Study Point is a Bangla-first coaching center website and LMS for SSC and HSC science students. The architecture follows the supplied `ABSP_Architecture_Guide.pdf` and is being implemented module by module.

## 1. Complete Software Architecture

The application is a full-stack Next.js App Router project with layered boundaries:

- Presentation: React Server Components, client components where interaction is needed, Tailwind CSS, ShadCN UI primitives.
- Application logic: Server Actions for form-first workflows and Route Handlers for API/mobile/client integrations.
- Domain/data layer: Mongoose models and repository-style helpers under `lib/db`.
- Infrastructure: MongoDB Atlas, Cloudinary or Mux for streaming media, JWT cookies, Vercel deployment, Sentry monitoring, Upstash rate limiting.

## 2. Folder Structure

Core folders:

- `app/[locale]/(public)`: public website pages.
- `app/[locale]/(auth)`: login and registration.
- `app/[locale]/(dashboard)`: protected student, teacher, and admin areas.
- `app/api`: API route handlers.
- `components`: reusable UI, layout, home, course, exam, CQ, and shared components.
- `lib`: database, authentication, Cloudinary, validation, route, permission, and i18n utilities.
- `messages`: Bangla and English translation files.
- `types`, `hooks`, `stores`: shared TypeScript contracts and client state.

## 3. Database Collections

Planned MongoDB collections:

- `users`: shared account identity for admin, teacher, and student.
- `students`: student profile extension.
- `teachers`: teacher profile extension and approval details.
- `courses`: SSC/HSC subject courses.
- `batches`: online/offline batch schedules and capacity.
- `videos`: recorded classes and streaming metadata.
- `mcqExams`: exam configuration, timing, marks, attempt limits.
- `mcqQuestions`: questions, options, correct answer, explanations.
- `results`: MCQ attempts, score, pass/fail, answer history.
- `cqAssignments`: teacher-created CQ tasks.
- `cqSubmissions`: student image uploads, marks, feedback.
- `enrollments`: student-course-batch relationship and progress.
- `notifications`: user notifications with TTL cleanup.

## 4. Authentication Flow

Registration accepts name, phone, password, and role. Students are approved immediately. Teacher accounts are created with `approvalStatus: pending` and cannot access teacher routes until an admin approves them.

Login validates the phone and password, checks `isActive` and approval status, then issues short-lived access and longer-lived refresh JWTs in HTTP-only cookies. Refresh rotates tokens. Logout clears cookies and stored refresh token state.

## 5. Route Structure

Public routes live under `/{locale}`:

- `/bn`, `/bn/about`, `/bn/courses`, `/bn/courses/[slug]`, `/bn/batches`, `/bn/contact`, `/bn/faq`

Auth routes:

- `/bn/login`, `/bn/register`

Protected routes:

- Student: `/bn/student`, `/bn/student/courses`, `/bn/student/exams`, `/bn/student/exams/[id]`, `/bn/student/assignments`, `/bn/student/results`
- Teacher: `/bn/teacher`, `/bn/teacher/classes`, `/bn/teacher/create-exam`, `/bn/teacher/review-cq`
- Admin: `/bn/admin`, `/bn/admin/students`, `/bn/admin/teachers`, `/bn/admin/courses`, `/bn/admin/analytics`

## 6. Role Permissions

- Admin: full management of students, teachers, courses, exams, videos, notes, CQ review, analytics, and approvals.
- Teacher: upload classes and notes, create MCQ exams, review CQ submissions, view course/student performance.
- Student: enroll in courses, watch enrolled videos, attend MCQ exams, submit CQ answers, see results.

## 7. Deployment Strategy

Use development, staging, and production environments. Deploy Next.js to Vercel, MongoDB to Atlas, media to Cloudinary or Mux, monitoring to Sentry and Vercel Analytics, and rate limiting to Upstash Redis. CI should run lint, type check, tests, and build before deployment.

## 8. Step-by-Step Implementation Plan

1. Module 1: project scaffold, route groups, base layout, route metadata, permissions, env template.
2. Module 2: Mongoose connection and database models.
3. Module 3: JWT authentication, cookies, registration, login, refresh, logout, route protection.
4. Module 4: ShadCN UI setup and premium ABSP design system.
5. Module 5: next-intl integration and complete Bangla/English messages.
6. Module 6: courses, modules, videos, notes, enrollment, progress.
7. Module 7: MCQ exams, timer, scoring, history.
8. Module 8: CQ assignment image upload, review, feedback.
9. Module 9: dashboards, analytics, pagination, search, filtering.
10. Module 10: deployment hardening, testing, monitoring, security.
