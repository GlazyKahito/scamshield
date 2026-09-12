# ScamShield Phase 2 — file placement

Unzip at the repo root. All paths below are relative to it.

## New files

```
components/ui/pages.module.css        shared styles for every non-landing page
components/analyzer/analyzer.tsx      3-mode analyzer, calls the real API routes
components/report/report-view.tsx     threat report renderer (shared)
lib/storage/history.ts                localStorage, key: scamshield_history
lib/content/scenarios.ts              5 simulator scenarios (all fictional)
lib/content/scam-library.ts           8 scam library entries (all fictional)

app/analyze/page.tsx                  /analyze
app/report/page.tsx                   /report        (most recent saved)
app/report/[id]/page.tsx              /report/:id    (one saved report)
app/dashboard/page.tsx                /dashboard
app/simulator/page.tsx                /simulator
app/scams/page.tsx                    /scams
app/about/page.tsx                    /about
```

If any of these already exist, back them up before overwriting.

## Untouched

Nothing in `app/api/`, `lib/security/`, `lib/ai/`, `lib/validation/` or `types/`
was modified. Phase 1 is intact.

## Dependencies

None added. No Tailwind config change. CSS Modules only.

## Import paths

All imports are relative (`../../types/analysis`), not `@/`. If your tsconfig
defines the `@/*` alias you may prefer to convert them, but relative paths work
either way.

## Prerequisites

These files assume `components/ui/site-nav.tsx` exists from the landing-page
drop — every page imports it. If you skipped that, add it first or remove the
`<SiteNav />` line and its import from each page.

## Verify

```bash
npm run typecheck
npm run build
npm test
```

Then walk: `/` → `/analyze` → Try an example → Analyze → Save → `/dashboard` →
click the entry → `/report/:id`. Then remove `GEMINI_API_KEY` from `.env.local`,
restart, and re-run one analysis — you should still get a full report with an
amber "AI analysis unavailable" banner.
