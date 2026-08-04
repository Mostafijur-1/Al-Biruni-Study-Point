# 03 — Existing Route Map

Next.js route groups are URL-transparent; paths below are the actual URLs produced by the build.

## Public and authentication

| Route | Source | Behavior | Classification |
|---|---|---|---|
| `/` | `app/(public)/page.tsx` | HSC 2028 landing page | Keep/improve |
| `/about` | `app/(public)/about/page.tsx` | Placeholder | Incomplete |
| `/batches` | `app/(public)/batches/page.tsx` | Static sample batches | Replace data source |
| `/contact` | `app/(public)/contact/page.tsx` | Contact information | Keep |
| `/courses` | `app/(public)/courses/page.tsx` | Static HSC subject catalog | Merge/improve |
| `/courses/[slug]` | `app/(public)/courses/[slug]/page.tsx` | Placeholder | Incomplete |
| `/faq` | `app/(public)/faq/page.tsx` | Placeholder | Incomplete |
| `/login` | `app/(auth)/login/page.tsx` | Login + return URL | Keep/harden |
| `/register` | `app/(auth)/register/page.tsx` | Student registration | Keep/harden |
| `/register/teacher` | `app/(auth)/register/teacher/page.tsx` | Pending teacher application | Keep/harden |
| `/bn` and `/bn/*` | `proxy.ts:14-18` | 301 to unprefixed path | Legacy compatibility; remove after link cleanup |

## Student

| Route | Main surface | Access/source decision |
|---|---|---|
| `/student` | Student home | Guest allowed by proxy; authenticated users get dashboard |
| `/student/courses` | Course/video catalog | Guest browsing + student mode |
| `/student/courses/video/[id]` | Video player/progress | Student only |
| `/student/practice` | Subject practice catalog | Guest allowed; authentication required to start |
| `/student/practice/[subject]` | Practice runner | Proxy guest allowance; APIs enforce student |
| `/student/exams` | Formal exams | Student only |
| `/student/exams/[id]` | Formal exam runner | Student only |
| `/student/assignments` | CQ assignment list | Student only; no submission implementation |
| `/student/results` | Results and solutions | Student only |
| `/student/learning` | Plan/mastery | Student only |
| `/student/mistakes` | Mistake notebook | Student only |
| `/student/coach` | Rule-based coach | Student only |
| `/student/game` | Game hub | Student only |
| `/student/challenge` | Daily challenge | Student only |
| `/student/focus` | Focus timer | Student only |
| `/student/goals` | Weekly goal | Student only |
| `/student/labs` | Science simulations | Student only |
| `/student/formulas` | Formula sprint | Student only |
| `/student/community` | Class community | Student only |
| `/student/profile` | Profile | Student only |

The student sidebar contains 17 destinations in `components/layout/DashboardMobileNav.tsx:46-81`. This is the clearest information-architecture overload.

## Teacher

| Route | Main surface | Finding |
|---|---|---|
| `/teacher` | Redirects to `/teacher/results` | No teacher dashboard |
| `/teacher/results` | General practice results | Primary landing by redirect |
| `/teacher/exams` | Formal exam list/builder | Working |
| `/teacher/exams/[id]` | Exam detail/questions/publish | Working with scoring/publish risks |
| `/teacher/mcq-review` | Practice bank/reports/ingestion | Working but monolithic |
| `/teacher/classes` | Videos/courses/CQ creation | Exists but absent from teacher navigation |
| `/teacher/review-cq` | Placeholder | Incomplete |
| `/teacher/profile` | Profile + teacher charge | Working |

Teacher navigation exposes only five entries (`DashboardMobileNav.tsx:82-103`), omitting `/teacher/classes` and `/teacher/review-cq`.

## Admin

| Route | Main surface | Finding |
|---|---|---|
| `/admin` | Overview + push broadcast | Working |
| `/admin/students` | Student management | Working |
| `/admin/teachers` | Teacher approval/scope/charges | Working |
| `/admin/practice-mcqs` | Practice settings + question management | Working; oversized |
| `/admin/courses` | Course summary | Exists but absent from nav |
| `/admin/analytics` | Renders `AdminOverview` | Duplicate of `/admin` |
| `/admin/settings` | Redirects to `/admin/practice-mcqs` | Misnamed |
| `/admin/profile` | Profile | Working |

Admin navigation exposes only overview, students, teachers, “settings” (actually MCQ management), and profile (`DashboardMobileNav.tsx:104-124`).

## Non-page application routes

- `/_not-found`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, icons.
- `proxy.ts` protects role prefixes and permits selected student guest routes.
- All dashboard routes set `robots: noindex, nofollow` in `app/(dashboard)/layout.tsx`.

## Routing findings

1. Public sitemap indexes placeholder pages.
2. Route availability and navigation availability diverge.
3. `/admin/analytics` and `/admin/settings` are aliases without distinct product purpose.
4. The legacy `/bn` redirect is correct live behavior, but README/docs still advertise `/bn` and `/en`.
5. Prefix matching uses `pathname.startsWith(prefix)`; it should use segment-aware matching before new similarly named routes are introduced.
