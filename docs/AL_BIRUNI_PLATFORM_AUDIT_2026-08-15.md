# Al-Biruni Study Point — Product, Academic, UX and Engineering Audit

**Audit date:** 15 August 2026 (Asia/Dhaka)  
**Repository state:** `main` at `2c7741a`, plus the existing uncommitted attendance working tree  
**Product focus:** HSC Science, initially HSC 2028  
**Decision:** discovery and recommendation only; no application feature or schema was changed

## 1. Executive summary

ABSP is already more than a coaching website. It has a credible Bangla-first public presence, authentication, student practice, formal MCQ exams, mistake review, chapter mastery, a rule-based learning plan, teacher question/exam workflows, PWA support, and a carefully gated academic-operations foundation. The strongest academic loop is:

`Practice → authoritative scoring → result → mistake review → chapter mastery → next recommendation`

That loop deserves to become the center of the product.

The principal problem is not a lack of features. It is that the platform has grown in several directions before its academic hierarchy and daily workflows became one coherent system. Ten secondary student tools, two separate MCQ architectures, legacy string-based curriculum data, gated canonical academic data, incomplete CQ submission, raw push notifications, and broad administrative surfaces compete for attention. The result is a system with substantial capability but weak product focus.

The recommended product thesis is:

> **ABSP should be the daily academic decision system for Al-Biruni: it should tell a student what to do next, tell a teacher who or what needs attention, and give administrators reliable academic operations—without turning into a generic LMS, a game, or a full ERP prematurely.**

### What is already strong

- Bangla-first identity, accessible skip link, responsive shell, calm academic brand, and a clear HSC 2028 public proposition.
- Server-authoritative practice/exam timing and scoring, attempt-session uniqueness, correct-answer isolation before submission, and idempotent repeated submission behavior.
- Mistake snapshots and spaced-review intervals; chapter mastery and deterministic recommendations.
- Phase 1 hardening: cross-teacher formal-result access is closed, academic attempts use void/archive instead of normal hard delete, publish-time mark invariants exist, cron auth is mandatory, broadcasts are admin-only, sessions have version-based revocation, and API failures have request IDs.
- Phase 2 code: Organization, Branch, AcademicSession, Subject, Chapter, Topic, Batch, Enrollment, TeacherAssignment, Routine, ClassSession, AuditLog, migrations, transactions, rollout evidence, and authorization-parity tooling.
- Quality discipline: 134 tests pass, lint passes, isolated source typecheck passes, and a clean production build produces 117 routes/assets.

### What remains structurally wrong

1. **Canonical academic data is code-complete but not operationally released.** Writes are default-off and the required staging/bootstrap/browser/evidence gates have not been approved. ABSP therefore still runs largely on legacy class/subject strings and embedded teacher domains.
2. **The learning hierarchy is split.** `AcademicSubject/Chapter/Topic` exist, but `PracticeQuestion`, courses, exams, mastery and labs are not consistently linked to those IDs. “Weak topic” detection is therefore chapter-level approximation, not true topic intelligence.
3. **The student home is not yet “Today.”** It performs five client API calls, prioritizes game/profile data, and a guest-visible `/student` route remains on an endless skeleton because loading never resolves when no user exists.
4. **CQ is a broken promise.** Assignment creation/listing exists, but submission returns 501 and teacher review is a placeholder.
5. **Feature breadth still exceeds demonstrated value.** Focus, goals, challenge, formulas, game, community, coach, labs, learning, and mistakes are hidden behind a Tools hub now—a real improvement—but they still create ten separate product and maintenance surfaces.
6. **Authorization is improved, not centralized.** The nominal `can()` permission helper is unused, 105 API authorization call sites remain, and 58 route-handler files directly import Mongoose models. Canonical teacher assignments are not yet the sole authority.
7. **Production dependency risk is current.** The 15 August npm advisory check reports four high-severity and one moderate vulnerability across Next.js, PostCSS, Sharp, Nano ID and Mongoose. Next.js includes a middleware/proxy bypass advisory relevant to this architecture.
8. **Operational and privacy readiness lag product scope.** There is no visible privacy/retention policy for a minor-oriented platform, no recovery/session-device UI, no structured observability, and deployment documentation is materially stale.

### Direction

- **Keep and harden:** practice, mistakes, mastery, formal exams, course/video basics, academic-core workflows, audit trail, secure session pattern.
- **Rebuild around one loop:** Student Today, targeted practice, exam feedback, Teacher Today and class insight.
- **Merge:** coach + learning plan; mistakes + revision; challenge + formula sprint + practice campaigns; game/goal cues into quiet progress signals.
- **Finish or hide:** CQ, About, FAQ, course detail and any unsupported public promise.
- **Defer:** AI tutor, public leaderboard, more simulations, native apps, full finance/ERP and new gamification.

## 2. Evidence, validation and limits

### Repository and runtime evidence

| Check | Result |
|---|---|
| Page routes | 48 |
| API route-handler files | 82 |
| Committed Mongoose model files | 49 |
| Working-tree model files including attendance draft | 54 |
| Unit/rule/contract tests | **134/134 pass** |
| ESLint | **Pass** |
| Isolated application-source typecheck | **Pass** |
| Production build | **Pass** after removing a corrupted generated `.next/dev` type cache; 117 outputs |
| Dependency advisory audit | **1 moderate + 4 high vulnerabilities** |
| Browser review | Public home, login, registration and guest student entry inspected locally |

The first development run experienced a Turbopack panic that corrupted generated route types. This caused the normal typecheck/build to fail until only the generated `.next/dev` type cache was removed. The clean production build then passed. Treat this as a reproducibility/tooling warning and add a clean-build CI check; it is not evidence that domain source failed type checking.

Authenticated student, teacher and admin data journeys were not executed because no approved disposable/staging accounts and database were supplied. No account was created, no production data was inspected, and no destructive endpoint was exercised. Mobile, keyboard and screen-reader behavior therefore still need an authenticated staging acceptance pass.

The browser audit materially changed two conclusions: the current public/auth shell is more usable than the older Phase 0 source-only review implied, while the guest student entry is demonstrably broken by an endless loading skeleton.

### Evidence anchors for product choices

- Classroom testing has a medium positive effect across a large evidence base, supporting retrieval practice as the core habit rather than passive content consumption: [Yang et al., 2021](https://pubmed.ncbi.nlm.nih.gov/33683913/).
- Distributed practice outperforms massed practice in applied classroom research, supporting due-date-based mistake review and revision scheduling: [Donoghue & Hattie, 2025](https://pubmed.ncbi.nlm.nih.gov/40564553/).
- Accessibility target: [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/), including focus visibility, target size, accessible authentication, status messages and complete-process conformance.
- Security acceptance should be expressed as testable controls using [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/), not an informal checklist.

## 3. Current product and system map

### 3.1 Roles

| Role | Current identity and access | Main limitation |
|---|---|---|
| Student | Public registration; own courses, practice, exams, results and tools | No operational batch truth in released runtime; no guardian/recovery/privacy flow |
| Teacher | Public application, admin approval, legacy teacher-domain scope plus new assignments | Canonical assignment authority is gated; analytics are result lists, not action queues |
| Admin | Global user, academic, question, overview and broadcast access | One global role combines academic, security and operations responsibilities |

Do not create separate `Student`, `Teacher` and `Admin` identity tables merely because the roles differ. Retain one `User` identity, then add profile and time-bounded role/assignment records only where the domain requires them.

### 3.2 Page routes

**Public/auth (10):** `/`, `/about`, `/batches`, `/contact`, `/courses`, `/courses/[slug]`, `/faq`, `/login`, `/register`, `/register/teacher`.

**Student (21):** `/student`; courses and video; practice and subject runner; exams and exam runner; assignments; results; learning; mistakes; coach; game; challenge; focus; goals; labs; formulas; community; profile; tools.

**Teacher (8):** dashboard, classes, exams, exam detail, MCQ review, results, CQ review, profile.

**Admin (9):** overview, students, teachers, practice MCQs, academic operations, courses, analytics alias, settings alias, profile.

Legacy `/bn/*` URLs permanently redirect to unprefixed paths. Documentation still advertises obsolete `/bn` and `/en` routes.

### 3.3 Backend modules

- **Identity/security:** JWT access/refresh cookies, session version, bcrypt, return-URL validation, rate limits, resource ownership helper, audit writer.
- **Academic core:** organization, branch, academic session, curriculum, batch, enrollment, teacher assignment, routine and class-session transactional workflows.
- **Learning:** courses, videos, video progress, daily plan, chapter mastery, mistake review.
- **Assessment:** practice question bank and attempt/result stack; separate formal exam/question/attempt stack; attempt sessions; answer scoring and publish invariants.
- **Engagement:** goals, coach, focus, challenge, formulas, game/quests/achievements, community, science lab.
- **Platform:** PWA, push subscription, product analytics, Cloudinary and three LLM providers for question ingestion.
- **Working-tree only:** attendance rules, validation, sheet/record/correction/idempotency/outbox models and service. There is no attendance route or UI, so this is not a current product capability.

### 3.4 Current data relationships

```text
User(student)
  ├─ Practice AttemptSession → PracticeAttempt → PracticeResult projection
  │                               ├─ MistakeReview
  │                               ├─ Chapter mastery projection
  │                               └─ XP/goal/challenge projections
  ├─ Exam AttemptSession → McqExamAttempt → published result
  ├─ VideoProgress → Video → Course
  └─ CQ assignment list (submission missing)

Organization → Branch + AcademicSession + AcademicSubject
AcademicSubject → AcademicChapter → AcademicTopic
Branch + Session → Batch
Batch → BatchEnrollment → User(student)
Batch + Subject → TeacherAssignment → User(teacher)
TeacherAssignment → RoutineSlot → ClassSession
ClassSession → Attendance (draft only, not routed/released)
```

The critical disconnect is that the lower academic tree does not yet own the upper learning/assessment records. Practice still identifies `subject` and `chapter` by strings; formal questions have optional topic strings; courses and labs use separate mappings.

### 3.5 Current workflows

**Student practice:** select level/subject/chapter → server freezes a question set → answer locally → submit → authoritative score → result/progress/mistake/reward updates → later mistake review.

**Formal exam:** teacher creates exam → adds questions → invariant check and first publication freeze → student starts timed session → submits idempotently → result is hidden until published → teacher may comment/void; exam may be archived.

**Teacher:** application → admin approval → task-launcher dashboard → class/content, question review, exam creation and result review. The dashboard does not yet answer which students/topics/classes need attention.

**Admin:** approve/manage users and legacy scope → manage questions/practice settings → view aggregates → broadcast → optionally use gated academic workspace for batches, enrollment, assignment, routine and sessions.

## 4. Major problems ranked by impact

| Rank | Severity | Finding | User/business impact | Recommendation |
|---:|---|---|---|---|
| 1 | Critical | High-severity Next.js/Sharp/PostCSS/Nano ID advisories; Next advisory includes proxy bypass | Possible route protection, availability and information exposure risk | Upgrade in a controlled branch, run full auth/build/E2E regression, deploy promptly |
| 2 | High | Canonical academic core is not rolled out and legacy teacher scope remains authoritative in most product modules | Attendance, class insight and branch isolation are not trustworthy end to end | Complete staging bootstrap, parity, browser and release evidence before new operational modules |
| 3 | High | Curriculum identity is fragmented across canonical IDs and legacy strings | Weak-topic analytics, question filtering and exam insight can be wrong or impossible to reproduce | Make Subject/Chapter/Topic IDs mandatory for new content and adapt legacy reads |
| 4 | High | CQ submission/review is visibly incomplete | A promised high-value HSC workflow cannot finish | Hide it immediately or complete private, idempotent submission and rubric feedback |
| 5 | High | No centralized permission + resource-scope policy | Future endpoints can repeat scope mistakes; role expansion is unsafe | `authorize(actor, action, context)` returning scoped DB filters; migrate every sensitive handler |
| 6 | High | No minor-oriented privacy policy, consent/retention catalog or session recovery | Trust, safeguarding and incident-response weakness | Publish privacy/retention terms; minimize data; add recovery and session management |
| 7 | High | Formal exam is immutable after first publish, but there is no true ExamVersion/QuestionVersion relationship or server-side answer autosave | Limited historical reproducibility and weak interruption recovery | Introduce future-version snapshots and delta autosave; preserve current compatibility |
| 8 | Medium | Guest `/student` never exits loading; Student Home makes five client calls | Broken first impression and poor weak-network experience | Resolve guest state; create one server-composed Today summary |
| 9 | Medium | Practice submit performs per-question reads | Higher submission latency and database load during peaks | Batch-load frozen questions once and score in memory |
| 10 | Medium | Teacher dashboard is a menu, not an academic decision surface | Teachers still inspect lists manually | Add Today, students needing attention, weak concepts and pending feedback actions |
| 11 | Medium | Optional tools remain ten separate domains | Maintenance and cognitive cost; unclear educational ROI | Merge and feature-flag; retain only measured learning-linked behavior |
| 12 | Medium | AI question ingestion persists generated questions before an explicit reviewed publication state | Inaccurate content can reach practice | Draft → validate → human review → publish with provenance/version |
| 13 | Medium | Raw push system lacks preferences, in-app inbox and delivery log; cron targets anonymous installs | Spam and weak targeting | Add notification policy, categories, recipient preview, preference and delivery record |
| 14 | Medium | Public offerings and docs are inconsistent | Credibility and operational mistakes | One published offering read model; rewrite README/architecture/deployment docs |
| 15 | Low | Mixed English/Bangla labels and unloaded Bangla font | Tone and rendering inconsistency | Approve terminology and self-host a Bangla-optimized font |

## 5. Keep / Improve / Merge / Simplify / Rebuild / Remove matrix

| Feature | Current state | Decision | Problem and recommendation | Priority |
|---|---|---|---|---|
| Public HSC 2028 home | Strong, focused offer | **Improve** | Fix MCQ CTA defaulting to SSC; data-back fees/batches; add admission steps and trust/privacy links | P0/P1 |
| Courses/public batches | Static + database sources | **Merge** | One published offering model for home, catalog and batch detail | P1 |
| About/FAQ/course detail | Placeholder or weak | **Remove until ready** | Do not index or navigate to unfinished pages | P0 |
| Login/registration | Working | **Improve** | Password recovery, accessible show-password, privacy notice, class-aware school/college label | P1 |
| Student Home | Five-call dashboard; guest bug | **Rebuild** | “আজ কী করব?” with one next action, due work and teacher notice | P0/P1 |
| Course/video learning | Working basics | **Improve** | Canonical chapter/topic/module links, enrollment access and continue-learning state | P1 |
| General MCQ practice | Strongest loop | **Keep + improve** | Add canonical topic/difficulty, batch reads, clear mode selection and weak-topic targeting | P1 |
| Formal MCQ exams | Hardened lifecycle | **Improve** | True versions, autosave/retry, exam schedule/eligibility and concise action-oriented results | P1 |
| Results | Score/history/comments | **Improve** | Chapter/topic diagnosis, trend and one next action; avoid chart overload | P1/P2 |
| Mistake Book | Real snapshot + spacing | **Keep** | Make it the primary Revision queue; support reason/tag and canonical topic | P1 |
| Chapter mastery | Deterministic projection | **Keep + improve** | Show confidence/sample size/recency; never imply certainty from few answers | P2 |
| Learning plan + coach | Two overlapping recommenders | **Merge** | One explainable Today/Revision recommender; deterministic first | P1 |
| Weekly goals | Useful habit cue | **Simplify** | Keep one academic goal; remove reward-claim ceremony | P2 |
| Daily challenge | Five-question practice | **Merge** | A practice campaign, not a separate destination/model family long term | P2 |
| Formula sprint | Useful recall format | **Merge** | Revision mode under subject/topic; connect cards to curriculum | P2 |
| Focus timer | Generic utility | **Simplify/defer** | Feature-flag; keep only if usage links to learning completion | P3 |
| Game hub/quests/cosmetics | Extensive | **Remove prominence** | Preserve data during experiment; retain streak/personal-best only if learning-linked | P2/P3 |
| Community encouragement | Anonymized but unmoderated | **Defer/rebuild** | Needs safeguarding, moderation, reporting and proven value | P4 |
| Science Lab | 18 formula simulations | **Rebuild selectively** | Embed high-value visualization into chapter learning; add objective, observation, explanation, common mistakes and viva | P3 |
| CQ assignment header | Creation/listing only | **Rebuild** | Private submission, retry, rubric, feedback, revision and audit | P1 |
| Teacher dashboard | Task launcher | **Rebuild** | Today, attendance/class action, weak topic, inactive student, pending review | P1 |
| Teacher result view | Scoped list/comment/void | **Improve/merge** | One Student Academic Profile plus class insight; remove duplicate result surfaces | P1/P2 |
| Teacher question bank | Upload/search/edit | **Rebuild incrementally** | Canonical hierarchy, difficulty/type, draft/review/publish, version, provenance, duplicate detection and bulk import | P1 |
| Admin overview | Counts and broadcast | **Improve** | Operational action queue and data-health exceptions, not vanity metrics | P1 |
| Admin academic workspace | Strong gated foundation | **Keep + release safely** | Complete evidence and integrate with all product scopes before attendance | P0/P1 |
| Admin analytics alias | Duplicates overview | **Remove** | Retain URL redirect only | P1 |
| Admin settings alias | Points to MCQ manager | **Remove/rename** | Reserve Settings for actual configuration | P1 |
| PWA install/offline shell | Working | **Keep** | Define offline boundaries; never imply exams are safely offline unless submission protocol supports it | P2 |
| Push notifications | Raw web push | **Rebuild** | In-app source of truth, preferences, delivery log, strict recipient scope | P2 |
| Product analytics | Allowlist + TTL | **Keep + govern** | Metric catalog, consent/notice, no vanity events | P1 |
| AI question parsing | Three-provider ingestion | **Improve** | Draft-only, cost quota, provenance, validation and reviewer accountability | P2 |
| Teacher charge calculation | Fragmentary billing | **Remove from academic core** | Do not evolve it into finance; validate real billing need before ledger work | P3 |

## 6. Ideal student experience

### Student Home / Today

The first screen should answer exactly seven questions, in this order:

1. আজ সবচেয়ে গুরুত্বপূর্ণ কাজ কী?
2. সামনে কোন পরীক্ষা বা deadline আছে?
3. কোন revision এখন due?
4. কোন assignment অসম্পূর্ণ?
5. সর্বশেষ ফলাফল থেকে কী করতে হবে?
6. শিক্ষক কী জানিয়েছেন?
7. আজ 10–20 মিনিট থাকলে কী করা যায়?

Recommended layout:

- One primary card: **“এখন শুরু করুন”** with time estimate and reason.
- A short “আজ” list: class, exam, assignment, revision.
- “সাম্প্রতিক ফলাফল” with one sentence and one action—not four charts.
- Quiet weekly consistency indicator; no coins, rank or confetti.
- Offline/weak-network state that shows cached schedule and protects in-progress answers.

### Personalized learning

**Weak-topic detection is valuable but not ready at topic level.** It requires every scorable question to have a reviewed `topicId`, enough attempts, recency weighting and confidence thresholds. Until then, label findings as “এই অধ্যায়ে বেশি ভুল হচ্ছে” rather than claiming a precise concept weakness.

Recommended deterministic model:

- Minimum 5–8 scorable responses before a topic label.
- Weight recent answers more, but retain longer-term evidence.
- Separate accuracy, consistency, time pressure and “not attempted.”
- Expose the reason: “শেষ ১২টি প্রশ্নে ৫টি ভুল; ৪টি friction topic-এ।”
- Action: 5-question diagnostic → explanation → 5-question spaced follow-up.

**Smart Revision** should rank due mistake reviews, weak/recent topics, upcoming exam coverage and time since practice. This is scheduling logic, not an AI problem.

**Mistake Book** creates genuine learning value because it already snapshots the exact question and supports spaced intervals. Improve it with “ভুলের কারণ” (concept/calculation/read-carelessly/guess), personal note, canonical topic and teacher-assigned review.

### Meaningful engagement

Keep:

- consecutive study days as a private consistency cue;
- weekly completion target;
- chapter coverage and mastery confidence;
- personal best and weekly learning summary;
- teacher-created short challenge tied to current class content.

Avoid coins, public rank, cosmetic shops, streak anxiety and reward-claim buttons. A streak freeze can reduce punishment, but the product should never imply that opening the app equals learning.

## 7. Practice, exam and question-bank architecture

### Practice modes worth keeping

1. **Topic/Chapter Practice** — the normal path.
2. **Revision Queue** — mistakes and due spaced review.
3. **Mixed Practice** — across recently taught chapters.
4. **Timed Exam Simulation** — only when the student explicitly wants exam conditions.

“Weak-topic practice” is a generated filter, not a fifth separate mode. Difficulty adaptation should wait until questions have reviewed difficulty metadata and sufficient outcome data.

Target hierarchy:

`Batch eligibility → Subject → Chapter → Topic → QuestionVersion → Practice/Exam use`

### Formal exam lifecycle

```text
Draft → validate coverage/marks → preview → publish immutable version
→ eligible students start → server/delta autosave → idempotent submit
→ moderation → result publish → student action + teacher class action
```

The result page should show:

- score, correct/incorrect/unanswered and time;
- at most three weak chapters/topics with evidence;
- comparison with the student’s own recent comparable assessments;
- common mistake explanation after result publication;
- one recommended next action.

Do not default to peer ranking. Class percentile may be available to authorized teachers, but students benefit more from mastery and improvement than rank.

### Scalable question bank

Required metadata: subject, chapter, topic, type, reviewed difficulty, source/provenance, explanation, language, status, version and owner. Quality workflow:

`Import/AI draft → structural validation → duplicate warning → academic review → publish → versioned reuse → report/correction`

Search and filters become justified once the bank exceeds roughly 500–1,000 questions. Before that, strong subject/chapter/topic filters and duplicate detection are sufficient.

## 8. Teacher and admin experience

### Teacher Workspace

Primary navigation: **আজ**, **Batch ও শিক্ষার্থী**, **Practice ও পরীক্ষা**, **Assignment**, **ক্লাস রিসোর্স**, **আরও**.

Teacher Today should answer:

- আজ কোন ক্লাস আছে এবং attendance/action কী?
- কোন submission বা result review pending?
- গত assessment-এ কোন concept-এ class ভুল করেছে?
- কোন 5–10 শিক্ষার্থী attention দরকার এবং কেন?
- গত সাত দিনে কারা practice বন্ধ করেছে?
- পরের ক্লাসে কী revisit করা উচিত?

Every insight needs an action: open roster, assign five questions, send scoped reminder, add class note, or review student profile.

**Student Academic Profile:** enrollment/batch, attendance when released, exam/practice trend, chapter evidence, due mistakes, assignments and teacher notes. Do not expose private device/telemetry data or unrelated coaching records.

### Admin

Separate two mental models, initially through permission groups rather than more top-level roles:

- **Academic Operations:** session, curriculum, batch, enrollment, teacher assignment, routine, class session, assessment moderation and attendance exceptions.
- **Platform Administration:** identity/access, configuration, audit, integrations, delivery health, retention and security.

Admin should not create every teacher exam or manage individual student practice. It should establish structure, exceptions, quality controls and oversight.

## 9. Proposed information architecture

| Student | Teacher | Admin |
|---|---|---|
| আজ | আজ | Overview |
| শেখা | Batch ও শিক্ষার্থী | Academic Operations |
| Practice ও Revision | Practice ও পরীক্ষা | People & Enrollment |
| পরীক্ষা | Assignment | Assessment & Content |
| Assignment | ক্লাস রিসোর্স | Communication |
| অগ্রগতি | আরও: profile/analytics | Security, Audit & Configuration |

Old routes should remain as redirects while usage is measured. The existing `/student/tools` consolidation is a good transitional step, not the final destination.

## 10. Target domain model

### Independent source-of-truth entities

- Identity: `User`, `UserSession`, `RoleAssignment`, `AuditLog`.
- Academic: `Organization`, `Branch`, `AcademicSession`, `Subject`, `Chapter`, `Topic`, `Batch`, `Enrollment`, `TeacherAssignment`, `RoutineSlot`, `ClassSession`.
- Learning: `Course`, `CourseModule`, `LearningResource`, `VideoProgress`.
- Assessment: `Question`, `QuestionVersion`, `Exam`, `ExamVersion`, `AttemptSession`, `AssessmentAttempt`, `Response`, `ResultPublication`.
- Revision: `MistakeReview`; `MasteryProjection` and `Recommendation` are rebuildable projections, not permanent truth.
- CQ: `Assignment`, `AssignmentVersion`, `Submission`, `SubmissionAsset`, `Evaluation`.
- Communication: `Announcement`, `Notification`, `NotificationDelivery`, `NotificationPreference`.
- Attendance after approval: `AttendanceSheet`, `AttendanceRecord`, `AttendanceCorrection`, idempotency and outbox records.

Do not create a generic mutable `StudentProgress` document containing everything. Do not make `Result` a second scoring truth if a submitted immutable attempt already contains the result. Do not create an `Admin` collection; permissions belong to role assignments.

### Migration approach

`Expand → dual-read/shadow-compare → backfill with exception report → switch authority → retain compatibility → contract later.`

No new practice/exam content should be created without canonical curriculum IDs after the cutover date. Legacy string aliases should be accepted only at import/adaptation boundaries.

## 11. Authorization and privacy

Target API:

`authorize(actor, action, resourceContext) → allow/deny + database scope`

The policy must be applied in the query filter, not only after loading a record. Core boundaries:

| Action | Teacher | Admin | Student |
|---|---|---|---|
| Create/edit question | Assigned subject/batch; own draft | Organization/branch oversight | No |
| Publish question | Only if explicitly granted reviewer permission | Academic/content reviewer | No |
| Create exam | Assigned subject and batch | Oversight/override with reason | No |
| Publish exam/result | Explicit assignment/permission; state rules | Override audited | No |
| View student detail | Active assigned batch/student only | Scoped operational need | Own only |
| Correct result/attendance | Reasoned request or assigned authority | Approve/override audited | View own status |
| Send announcement | Assigned recipients only | Scoped broadcast | Receive/preferences |

Privacy baseline for a minor-oriented product:

- publish plain-language privacy and retention notices;
- collect only academic/operational data required for the service;
- define retention for attempts, telemetry, push endpoints, uploads, logs and AI prompts;
- never send student identity/history to an LLM for ordinary recommendation logic;
- add guardian linking only through verified relationships;
- provide account recovery, session/device revocation and sensitive-action audit;
- use ASVS 5.0.0 controls as test cases and threat-model exam, upload, auth and staff-scope workflows.

## 12. Analytics, AI, notifications and search

### Metrics that answer real questions

**Student:** Did I practice consistently? What evidence shows a weak chapter/topic? What is due for revision? Am I improving on comparable work?

**Teacher:** Which students stopped practicing? Which topic caused the most errors? Who missed/failed the latest assessment? What should the next class address?

**Admin:** Are rosters/assignments complete? Are classes/exams being delivered? What exceptions need action? Is content coverage aligned to plan? Are notification and system failures rising?

Do not show page views, raw XP, total questions in the bank or install count as headline success metrics. Proposed product outcome measures:

- weekly active learning students completing at least one meaningful task;
- due revision completion rate;
- improvement on repeated comparable topic checks;
- exam participation/submission reliability;
- teacher weekly action completion and time-to-feedback;
- percentage of classes/content/questions linked to canonical curriculum IDs.

### AI decision table

| Use | Decision | Why |
|---|---|---|
| Weak-topic ranking | Deterministic | Structured answer data is more reliable, cheap and explainable |
| Revision scheduling | Deterministic | Spacing, recency, mistakes and exam dates are explicit signals |
| Teacher class-insight summary | AI optional later | Useful only after deterministic metrics; must cite underlying counts |
| Question import/parser | Keep with human review | Reduces entry work, but generated content needs provenance and approval |
| Student explanation | Future guarded pilot | Must be grounded in approved content, age-appropriate and reportable |
| AI tutor/chatbot | Not recommended now | High reliability, privacy, moderation and cost burden; weaker than core gaps |

### Notifications

| Category | Examples | Channel |
|---|---|---|
| Critical | Exam change/cancellation, account/security | In-app + push when opted in |
| Academic | New exam, result, teacher announcement | In-app; push for time-sensitive items |
| Reminder | Due revision/assignment | In-app; at most one batched push/day by preference |
| Informational | Weekly summary | In-app; optional email later |

The in-app record should be the source of truth. Push is a delivery channel, not the notification model.

Unified global search is not justified yet for students. Add scoped question-bank search for teachers now; add student resource/topic search only after canonical content volume and analytics show navigation failure.

## 13. Mobile-first design and accessibility

Visual direction: **Academic + Modern + Trustworthy + Calm + Focused**. Preserve navy/red/yellow identity, semantic tokens, responsive shell, skip link and reduced motion.

Priorities:

- self-host a Bangla-optimized font with only used weights;
- one primary action per student screen;
- 44px minimum common touch controls and WCAG 2.2 AA target-size handling;
- bottom navigation with 4–5 primary actions;
- responsive card list instead of wide tables for teacher mobile use;
- clear skeleton, empty, offline, retry and conflict states;
- progress/status with semantic roles and text, not color alone;
- exam timer warnings announced accessibly without stealing focus;
- visible last-saved/submitted state and recoverable answer synchronization;
- keyboard focus trap/restore for mobile sheets and confirmation dialogs;
- test complete journeys, not isolated pages, at 320/390/768/1024/1440 widths.

Avoid excessive cards, gradients, hover lifts, animated rewards, glass effects and statistics walls.

## 14. Engineering, security, performance and reliability audit

### Strengths

- Appropriate Next.js/React/TypeScript/Mongoose stack; no framework rewrite is justified.
- Strict TypeScript, schema validation on many mutations, secure cookie flags and bcrypt cost 12.
- Request IDs and safe API error envelope; rate limits; file signature/size checks.
- Attempt-session and answer-scoring regression tests; publish invariants and archive/void audit.
- Transactional academic workflows, collision rules, effective dates, indexes and explicit rollout gates.
- CI runs typecheck, lint, tests, build and SonarQube; separate manual Mongo transaction validation exists.

### Technical findings

| Severity | Finding | Action |
|---|---|---|
| Critical | Dependency advisories: Next 16.2.6 falls in multiple high-severity ranges, including proxy bypass; Sharp/PostCSS/Nano ID high; Mongoose moderate | Upgrade and regression-test immediately; do not run blind `audit fix --force` |
| High | Policy enforcement still scattered; `can()` unused; canonical assignment not universal | Policy migration with action/resource matrix integration tests |
| High | Curriculum and assessment models are duplicated/partially linked | Canonical-ID cutover and versioned question/assessment kernel |
| High | CQ/private asset lifecycle missing | Build idempotent private submission or remove promise |
| High | Deployment docs recommend `0.0.0.0/0`, stale token defaults and obsolete locale URLs | Rewrite operational docs; least-privilege Atlas networking |
| High | No structured observability/error tracker, security-event catalog or restore evidence | Redacted structured logs, tracing/request ID, alerts, backup restore drill |
| Medium | `McqPracticeRunner` remains 1,798 lines; other question/lab/admin clients are very large | Split state machines, data hooks, forms and presentation; characterization tests |
| Medium | 58 API route files directly access models | Extract services where policy, transactions or reuse justify them |
| Medium | Student dashboard fan-out; practice submit N+1 | Aggregated Today read service; batch question read |
| Medium | Attempt answers still use weak `[Object]` nested schema in formal attempts | Explicit response sub-schema and immutable snapshot |
| Medium | Question records can be hard-deleted although attempts/mistakes may reference them | Archive/version; purge only through retention workflow |
| Medium | Provider and push errors log response text/endpoints | Redact secrets, endpoints, student content and provider payloads |
| Low | Debug logging remains in teacher/PWA components | Remove or gate behind structured development logger |

### Dependency advisory details

- Next.js: [GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) and other availability/disclosure advisories; npm recommends a version outside the current exact dependency range.
- Mongoose: [GHSA-664h-wqgq-64gw](https://github.com/advisories/GHSA-664h-wqgq-64gw).
- Nano ID: [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) and [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
- PostCSS and Sharp advisories are transitive through the current Next installation.

### Reliability contract for exams

- start returns a frozen version/session and authoritative expiry;
- answer changes are delta-autosaved with version/sequence and visible last-saved state;
- submit uses idempotency and returns the already-stored outcome on retry;
- client queues on transient loss and never silently discards an answer;
- server rejects unknown/duplicate questions and uses final answer only;
- teacher publication cannot alter an active version;
- operations have p95 latency/error/SLO dashboards and a staging load test with headroom.

## 15. Feature value scoring

Scores are 1–5. Higher complexity/UX cost is worse.

| Proposal | Learning | Engagement | Teacher | Operations | Complexity cost | UX cost | Scale | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Student Today + one next action | 5 | 5 | 2 | 2 | 3 | 1 | 5 | P1 |
| Canonical curriculum integration | 5 | 2 | 5 | 5 | 4 | 1 | 5 | P0/P1 |
| Mistake Book + smart revision | 5 | 4 | 3 | 1 | 3 | 1 | 5 | P1/P2 |
| Teacher Today/class insights | 5 | 2 | 5 | 4 | 4 | 2 | 5 | P1/P2 |
| Complete CQ workflow | 5 | 3 | 5 | 3 | 4 | 2 | 4 | P1 |
| Attendance pilot | 3 | 2 | 5 | 5 | 5 | 2 | 5 | P1 after gates |
| Question version/review workflow | 5 | 1 | 5 | 4 | 4 | 2 | 5 | P1 |
| Notification preferences/inbox | 2 | 4 | 3 | 4 | 3 | 2 | 5 | P2 |
| Guardian portal | 3 | 3 | 3 | 4 | 4 | 2 | 4 | P3 after core |
| Selective chapter visualizations | 3 | 3 | 3 | 1 | 4 | 2 | 3 | P3 |
| Finance ledger | 1 | 1 | 1 | 5 | 5 | 3 | 5 | P3/P4, validate need |
| AI teacher summary | 2 | 1 | 3 | 2 | 4 | 2 | 3 | P4 pilot |
| AI student tutor | 2 | 3 | 1 | 1 | 5 | 4 | 2 | Not recommended now |
| Public leaderboard | 1 | 3 | 1 | 1 | 2 | 4 | 3 | Not recommended |
| More currencies/coins/badges | 1 | 3 | 1 | 1 | 3 | 4 | 3 | Not recommended |

## 16. Prioritized roadmap

### P0 — Foundation and release safety

1. Upgrade vulnerable dependencies in a controlled branch; run auth/proxy/API/build and browser regression.
2. Fix guest Student Home endless loading and the HSC home CTA that opens SSC practice.
3. Hide CQ submission/review and public placeholder routes until complete.
4. Complete central authorization inventory; require policy + canonical scope on all sensitive reads/mutations.
5. Finish Phase 2 operational gates: approved manifest, dry-run/apply in staging, DB transaction test, scope parity, authenticated desktop/mobile/accessibility evidence.
6. Publish privacy/retention policy; add account recovery design and security-event retention.
7. Rewrite README, architecture and deployment docs; remove obsolete bilingual and unsafe Atlas guidance.

### P1 — Core experience

1. Make canonical Subject/Chapter/Topic IDs authoritative for new questions, exams, courses, resources and analytics.
2. Rebuild Student Home as server-composed Today; merge coach/plan.
3. Build Teacher Today and Student Academic Profile with action-oriented insight.
4. Complete CQ submission/evaluation with private assets and audit.
5. Version future questions/exams and add server-side exam answer autosave/recovery.
6. Consolidate question managers and introduce draft/review/publish/provenance.
7. Decompose highest-risk client components and remove N+1/unbounded reads.
8. Only after Phase 2 evidence, release attendance to one named pilot branch using the existing default-off gate.

### P2 — Learning intelligence

1. Topic-level evidence and confidence-aware weak-topic detection.
2. Smart revision across mistakes, recency, exam coverage and time available.
3. Class concept insight and inactive-student alerts with direct teacher actions.
4. In-app notifications, preferences, templates, delivery log and weekly summary.
5. Metric catalog, data-quality monitoring and outcome experiments.

### P3 — Enhancements

- Selective chapter-integrated science visualization.
- Guardian portal after identity, attendance and result truth are stable.
- Admission and fee workflow only after operational discovery; use an immutable ledger if approved.
- Scoped exports, richer reporting and content coverage planning.

### P4 — Future exploration

- Grounded AI explanation using approved content and strict evaluation.
- AI teacher-summary pilot that always cites deterministic metrics.
- Native app only if PWA evidence shows a concrete capability gap.
- Additional coaching modules only after validated demand.

### Explicitly not recommended

- public leaderboards, coins, more cosmetic economies or new standalone game destinations;
- an open-ended AI tutor or automated grading of high-stakes CQ;
- more science simulations before existing ones are academically reviewed and integrated;
- a language switcher while the product is intentionally Bangla-first;
- global search before content volume justifies it;
- full accounting/payroll/library/inventory/transport/hostel modules in the current product phase;
- a framework rewrite, microservices, event streaming platform or native app for technical prestige;
- any production attendance rollout before the current academic-core and attendance evidence gates pass.

## 17. Decision gates and next action

The next delivery phase should not be “build more features.” It should be a bounded **P0 release-safety and academic-authority phase** with seven acceptance outcomes:

1. no known high-severity production dependency advisory in deployed code;
2. canonical academic scope proven in staging and used by sensitive product modules;
3. no visible dead-end or endless-loading route;
4. no unsupported CQ/public promise;
5. approved privacy/retention and recovery design;
6. clean tests, typecheck, lint, production build, authenticated mobile/desktop and accessibility evidence;
7. a measured decision on which optional student tools remain enabled.

Only after those gates should ABSP invest in attendance rollout, CQ completion and learning intelligence. This sequence makes the platform simpler to use while increasing its educational and operational power.

