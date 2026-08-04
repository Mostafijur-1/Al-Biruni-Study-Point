# 02 — Existing Feature Inventory

Classification reflects source behavior, not route names alone.

| Area | Current implementation and evidence | Status | Decision |
|---|---|---|---|
| Public home | Static HSC 2028 marketing, fees, batches and tutor in `components/home/HomeSection.tsx` | Working | Improve: clearer admission CTA and Bangla metadata |
| Courses | Static catalog plus Mongo `Course`; `/courses/[slug]` is a placeholder | Partial | Merge static/DB catalog; complete detail or hide route |
| Batches | Dictionary-backed sample cards; `/api/batches` returns 501 | Incomplete | Replace with session/branch/batch domain |
| About and FAQ | `RoutePlaceholder` pages | Incomplete | Complete before indexing or remove from nav/sitemap |
| Contact | Address/phone/email and CTA | Working | Keep; validate current operational content |
| Authentication | Student/teacher registration, login, refresh rotation, logout, profile | Working with risks | Harden; add recovery, session management and audit |
| Student guest browsing | Guest access to student home/courses/practice; auth gate redirects | Working | Improve; do not expose private media URLs |
| Student home | Five parallel client API calls in `StudentHomeDashboard.tsx:152-157` | Working | Improve into task-first server-composed dashboard |
| Courses/videos | Teacher creates course/video; student filters by class; progress tracking | Partial | Improve; add enrollment/access policy and content hierarchy |
| CQ assignments | Teacher can create/list assignments | Partial | Improve |
| CQ submission/review | `/api/cq/submit` is 501 and teacher page is placeholder | Broken/incomplete | Rebuild as assignment submission workflow |
| General MCQ practice | Chapter/subject selection, attempt sessions, autosave UI, scoring, results | Working | Keep and harden |
| Teacher-set practice | Teacher question bank filtered by assigned domain | Working with policy gaps | Improve |
| Formal MCQ exams | Teacher CRUD/questions/publish/results; student start/submit/review | Working with P0 risks | Replace published/scoring lifecycle while preserving UI behavior |
| Question ingestion | Text via Groq/Gemini; image via OpenRouter; teacher/admin review tools | Working | Improve governance, versioning, provenance and quotas |
| Result history | Practice and published exam results | Working | Improve privacy and audit |
| Mistake notebook/mastery | Spaced review, mastery, learning plan | Working | Keep; connect to curriculum entities |
| Study coach | Rule-based check-in/recommendation | Working | Merge under learning plan; label as recommendation, not AI certainty |
| Focus studio | Timed focus sessions and XP | Working | Product decision: keep behind feature flag |
| Goals | Weekly target/reward board | Working | Merge with learning plan |
| Game hub/quests | XP, levels, streaks, achievements, cosmetic rewards | Working | Reduce prominence; retain only learning-linked rewards |
| Daily challenge | Five-question class challenge | Working | Merge into practice |
| Formula sprint | Five-card confidence drill | Working | Merge into revision/practice |
| Community | Anonymized class activity and encouragement | Working | Product decision; moderation and safeguarding required |
| Science lab | 18 formula/control simulations; one 1,288-line visualizer | Working but limited | Improve framework/content; no new labs until core is stable |
| Teacher dashboard | `/teacher` redirects to results | Incomplete | Replace with actionable dashboard |
| Teacher results | Scoped practice results, comments, destructive deletion | Working with P0 data risk | Replace deletion with correction/void workflow |
| Teacher courses/classes | Video/course/CQ creation | Partial and hidden from nav | Improve and align with assignment scopes |
| Admin dashboard | User counts, practice stats, install counts, teacher charges, broadcast | Working | Improve; separate accounts/security/academic operations |
| User/teacher management | Approval, activation, class/subject/student domain assignment | Working | Replace embedded domain array with scoped assignments |
| Admin analytics | Exact duplicate of admin overview | Redundant | Merge/remove route |
| Admin settings | Redirects to practice MCQ manager | Misleading | Replace with real configuration IA |
| Notifications | Anonymous/auth push subscriptions, broadcast, evening cron | Working with security/privacy gaps | Harden and add templates/preferences/delivery log |
| PWA | Manifest, service worker, install/launch tracking | Working | Keep; minimize personal telemetry |
| Product analytics | Student event allowlist with 180-day TTL | Working | Keep with metric catalog and privacy policy |
| Finance | Teacher-upload charge calculation only | Fragmentary | Do not call finance; replace later with ledger-backed fees/accounts |
| Guardian/parent | No role, model, route or API | Missing | P2 after academic/identity foundation |
| Attendance/routine/admissions | No domain model or workflow | Missing | P1 after foundation |
| Branch/multi-tenant | No organization or branch key | Missing | P1 foundation prerequisite |
| Background work | One Vercel cron route; no job queue/outbox | Minimal | Improve only for notifications/reports |

## Third-party integrations

- MongoDB Atlas through Mongoose (`lib/db/connect.ts`).
- Cloudinary image upload (`lib/cloudinary/upload.ts`).
- Web Push/VAPID (`app/api/admin/broadcast`, `app/api/cron/evening-reminder`).
- Groq and Gemini text parsing; OpenRouter vision parsing (`lib/ai`).
- Vercel deployment and cron (`vercel.json`).
- SonarQube CI scan (`.github/workflows/sonarqube.yml`).

Not implemented despite documentation claims: Sentry, Upstash, Mux, Vercel Analytics, staging automation, and backups.
