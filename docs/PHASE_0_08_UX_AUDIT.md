# 08 — UX Audit

Interactive browser testing was unavailable. Findings are based on rendered HTTP responses, responsive source behavior, route composition and user-facing copy. Keyboard focus loops, contrast in pixels, screen-reader output and authenticated visual workflows remain to be verified.

| Problem | Affected users / why it matters | Evidence | Recommendation | Priority / complexity | Dependencies / change risk |
|---|---|---|---|---|---|
| Student feature overload | Students; 17 choices obscure “what next” | `DashboardMobileNav.tsx:46-81` | Six top groups: হোম, শেখা, Practice, পরীক্ষা, কাজ, অগ্রগতি; place tools contextually | P1 / medium | IA + analytics; risk of discoverability drop, preserve redirects |
| Dashboard is client-assembled | Students on slow mobile; multiple loading/error states | Five APIs in `StudentHomeDashboard.tsx:152-157` | Server-composed dashboard summary with one primary next action | P1 / medium | Dashboard service; cache/privacy design |
| Teacher has no home | Teachers cannot see today/pending/alerts | `/teacher` redirects to results (`app/(dashboard)/teacher/page.tsx:5`) | Actionable teacher dashboard | P1 / medium | Batch/routine/assignment foundations |
| Hidden teacher workflow | Teachers cannot discover class content upload | `/teacher/classes` absent from teacher nav | Rename as “ক্লাস ও রিসোর্স” and expose if permission allows | P1 / low | Navigation policy |
| Admin labels misrepresent screens | Admin mental model breaks | “সেটিংস” points to practice MCQ; analytics duplicates overview | Re-group Academic, People, Content, Reports, Configuration | P1 / medium | New IA and redirects |
| Placeholder journeys | Prospects/students/teachers hit dead ends | About, FAQ, course detail, CQ review; 501 APIs | Hide incomplete links/routes or finish end-to-end | P1 / low-high | Product copy/content/CQ backend |
| Mixed English/Bangla UI | All Bangla-first users; tone is inconsistent | English headings/buttons across Admin, Teacher, Results; locale branches remain | Apply terminology guide and remove runtime language ternaries | P1 / medium | Terminology inventory; snapshot QA |
| Unnatural/childish voice variance | Students/teachers; trust and age fit vary | “চ্যাপ্টার সিলেক্ট করো”, “তোমার নাম লিখো” vs formal “করুন” | Use respectful role-aware voice: student neutral-friendly, staff formal | P1 / low | Copy review |
| Destructive results are prominent | Teachers may erase more than intended | “Delete Attempt” UI calls endpoint that wipes subject history | Replace with “ফলাফল বাতিল/সংশোধন অনুরোধ”; show scope | P0 / medium | Backend immutability/audit |
| CQ implies submission but cannot submit | Students/teachers; broken core promise | Assignment list works, submit/review placeholder | Remove submission CTA until complete, then guided upload/status flow | P1 / high | Submission model/storage/review |
| Public content is inconsistent | Prospective students/guardians; credibility/SEO | Static HSC-only catalog, sample batches, placeholder detail | Single data-backed offering model with current dates/fees/capacity | P1 / medium | Batch/catalog domain |
| Weak error localization | All roles; recovery is unclear | API errors are English; root error says “Something went wrong” | Map domain errors to concise Bangla recovery text + correlation ID | P1 / medium | Error taxonomy |
| Mobile navigation is long | Students; “More” opens a two-column list of 13 secondary tools | Source navigation split | Prioritize four frequent actions; contextually surface the rest | P1 / medium | Usage analytics |
| Tables/actions inconsistent | Teachers/admin; repeated visible destructive actions | Large custom result/question managers | Shared responsive data-view pattern, overflow actions, saved filters | P2 / high | Design system/data table |
| Onboarding is missing | New students/teachers; first successful action is unclear | Registration redirects to dashboard; no setup checklist | Minimal class/profile confirmation and first-practice path | P2 / medium | Enrollment/profile rules |

## Accessibility observations

Positive evidence: `<html lang="bn">`, skip link, reduced-motion CSS, visible focus classes, 44px-ish mobile controls, semantic tables, dialog roles in the dashboard more sheet, and upload MIME/signature validation.

Risks requiring browser verification:

- The mobile public menu does not declare `role="dialog"`, `aria-modal`, or an explicit focus trap.
- Custom confirmation overlays and large exam runners need focus restoration and screen-reader announcements.
- Progress bars are visual `div`s without `role="progressbar"`/value attributes.
- Status frequently relies on colored badges plus some text; verify every case.
- CSS names Bangla fonts but loads no font files, so rendering depends on the OS.
- `font-display` uses Playfair Display before Noto Serif Bengali; it is not loaded and may create inconsistent fallback metrics.

## Key task click targets

Current exact click counts could not be measured without authenticated browser sessions. Source-level paths indicate: teacher attendance is impossible; student practice is at least dashboard/nav → subject → chapters/config → start; teacher exam creation is exam list → form → exam detail → upload/add questions → publish. Phase 1 research should measure these with three real roles and mobile devices.
