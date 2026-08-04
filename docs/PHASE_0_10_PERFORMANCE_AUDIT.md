# 10 — Performance Audit

## Observed baseline

- Production build: 57.9 s total in this environment; compile 21.1 s, TypeScript 21.3 s, 112 static/dynamic outputs.
- Local warmed root: ~85 ms; student practice: ~148 ms; login first hit: ~3.72 s; student first hit: ~1.36 s.
- Live root: cached 200 with `X-Vercel-Cache: HIT`; live health/database ping: ~3.15 s.
- Local health timed out to 503 after ~48.7 s because sandbox network could not reach the configured database; this is not treated as production downtime.

## Findings

| Priority | Finding | Evidence/impact | Recommendation |
|---|---|---|---|
| P1 | Practice submit performs N+1 database reads | `practice/submit/route.ts:168-171` calls `loadFullQuestionById` per question | Fetch all frozen question docs once and map in memory |
| P1 | Dashboard fan-out is client-side | Five parallel calls in `StudentHomeDashboard.tsx:152-157`; repeated auth/DB work and loading churn | One dashboard query/service with projections and bounded parallelism |
| P1 | Very large client bundles/components | Four components exceed 1,200 lines; 52 client components | Split stateful islands, dynamically load labs/charts/editors, measure bundle |
| P1 | Mongo rate limit writes on every tracked/auth action | Fixed-window buckets use DB upserts | Retain initially; monitor, then move to managed limiter only if needed |
| P1 | Unbounded/large reads | Teacher question lists can return all matching questions; courses/videos limit 100 without cursor | Cursor pagination and field projection |
| P1 | Exam publish/read lacks frozen version | Mutable question reads can change historical review and cache behavior | Snapshot published assessment/version |
| P2 | PWA registers/tracks with verbose console output | Client noise and additional requests | Production logging guard and batched telemetry |
| P2 | Fonts are not actually loaded | CSS fallback causes layout variability and potentially poor Bangla metrics | Self-host a subsetted Bangla font; preload only required weights |
| P2 | Science visualizer is a single large module | All visualization branches share 1,288-line client file | Registry + per-lab dynamic modules; preserve 2D/browser-native rendering |
| P2 | Admin overview recomputed on demand | Multiple counts and teacher-charge list | Define freshness; short private cache or materialized summary if measured |

## Performance budgets for Phase 1

- Public LCP ≤2.5 s p75 on mid-range Android/4G; CLS ≤0.1; INP ≤200 ms.
- Authenticated task shell ≤200 KB route JS gzip for ordinary dashboards; heavy labs loaded on demand.
- Dashboard server response p95 ≤800 ms warm; no more than one client data round-trip for initial actionable content.
- Exam start/submit p95 ≤2 s at validated concurrency with <1% errors; retain 30% headroom from load test.
- Paginated lists default 25, maximum 100; no unbounded student/attempt/question query.
- Autosave payload bounded to answer deltas; do not cache private results in shared caches.

## Measurement gaps

No Lighthouse/Web Vitals/browser trace, bundle analyzer, Mongo explain plan, Atlas metrics, or authenticated load test was available in this pass. The repository includes a useful exam API load harness, but it must run only against isolated staging.
