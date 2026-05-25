# ABSP Product Requirements (PRD)

**Al-Biruni Study Point (ABSP)** — science coaching center website and learning platform for SSC and HSC students in Bangladesh.

## Audience & levels

| Level | Classes | Subjects taught |
|-------|---------|-----------------|
| **SSC** | 9–10 | Physics, Chemistry, Math, Higher Math, ICT |
| **HSC** | 11–12 | Physics, Chemistry, Higher Math, ICT |

## Tech stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Database:** MongoDB (Mongoose)
- **Languages:** Bangla (default), English — URL prefix `/bn`, `/en`
- **AI:** Not in v1 (planned later)

## Feature 1 — Public home

Single landing experience (also mirrored on dedicated pages):

1. **About ABSP** — mission, values, why choose us
2. **Courses** — SSC and HSC subjects listed separately
3. **Current batches** — active offline and online batches with schedule/capacity
4. **Main tutor** — lead instructor profile (photo, subjects, bio)

Additional public pages: `/about`, `/courses`, `/batches`, `/contact`, `/faq`.

## Feature 2 — Authentication & roles

| Role | Registration | Access |
|------|--------------|--------|
| **Student** | Phone + password; active immediately | Limited student routes (dashboard, courses, exams, CQ, results) |
| **Teacher** | Phone + password; **pending until admin approves** | Limited teacher routes after approval (classes, MCQ create, CQ review) |
| **Admin** | Seeded / internal | Full management (students, teachers, courses, analytics) |

- Route protection by role via middleware (`proxy.ts`)
- JWT in HTTP-only cookies (access + refresh)

## Feature 3 — Courses & learning

Per course (per level + subject):

1. **Recorded video classes** — watch when enrolled
2. **MCQ exams** — select answers → submit → instant score; show explanations/short notes where provided
3. **CQ (creative) exams** — student submits answer **photos** → teacher reviews → sets marks and feedback

Courses are grouped under **SSC** and **HSC** on the public site and in the database.

## Out of scope (v1)

- AI tutoring, AI grading, chatbots
- Live streaming classes (recorded only for now)
- Payment / billing
- Native mobile apps

## Success criteria (MVP)

- [ ] Home shows about, courses (SSC/HSC), batches, main tutor in Bangla by default
- [ ] Student can register, log in, and reach only student routes
- [ ] Teacher registers but cannot use teacher tools until admin approves
- [ ] Admin can approve teachers and manage catalog
- [ ] Student can watch videos, take MCQ, see results + solutions
- [ ] Student can submit CQ photos; teacher can grade

## Implementation phases

See `docs/ARCHITECTURE.md` for module-by-module technical plan.
