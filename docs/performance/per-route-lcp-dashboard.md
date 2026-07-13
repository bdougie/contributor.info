# Per-Route p75 LCP Dashboard (PostHog)

Real-user web vitals are sent to PostHog by the pipeline in
`src/lib/web-vitals-monitoring.ts` -> `src/lib/web-vitals-analytics.ts` ->
`src/lib/posthog-lazy.ts`. This doc explains which event and properties to
use to build a p75 LCP-by-route dashboard.

## Which event to use

Use the **`web_vitals_batch`** event. This is the event the app actually
emits in production (metrics are buffered and flushed in batches). The
single-metric `web_vitals` event exists in `posthog-lazy.ts` but currently
has no callers.

Relevant properties on `web_vitals_batch`:

| Property | Meaning |
| --- | --- |
| `lcp_value` | LCP in milliseconds for the page view |
| `lcp_rating` | `good` / `needs-improvement` / `poor` |
| `route_pattern` | Route template, e.g. `/`, `/trending`, `/:owner/:repo`, `/workspace/:id/:tab` |
| `page_path` | Raw pathname where the metric was recorded (e.g. `/continuedev/continue`) |
| `page_url` | Full URL at flush time |
| `fcp_value`, `cls_value`, `inp_value`, `ttfb_value` | Other vitals, same naming scheme |

`route_pattern` is derived in `src/lib/route-pattern.ts` (mirrors the route
table in `src/App.tsx`), so all repo pages aggregate under `/:owner/:repo`
instead of thousands of distinct pathnames. Use `page_path` only when you
need to drill into a specific page.

Caveats:

- Events only flow after PostHog loads, which happens on first user
  interaction (see `src/App.tsx`), so bounce-without-interaction sessions
  are not represented.
- `route_pattern`/`page_path` were added to this event in July 2026; filter
  the dashboard date range accordingly.

## Building the dashboard

1. In PostHog, create a new **Insight** -> **Trends**, and select the
   `web_vitals_batch` event.
2. Set the metric to **Property value (p75)** (under aggregation options)
   on the numeric property `lcp_value`.
3. **Break down** by the `route_pattern` property.
4. Add a filter `lcp_value is set` so batches that flushed without an LCP
   sample (e.g. tab backgrounded) don't dilute the series, and optionally a
   device/browser breakdown or filter (e.g. `$device_type = Mobile`) to
   match the mobile lab data from Lighthouse CI.
5. Save the insight to a **Performance** dashboard. Add companion insights
   for `cls_value` and `inp_value` with the same breakdown, and set the
   reference line at 2500 ms (LCP "good" threshold) / 4000 ms ("poor").

Routes to watch first, per the 2026 performance audit: `/:owner/:repo`,
`/trending`, and `/workspaces` (mobile p75 LCP was 4.9-5.6 s). These same
routes are now audited in CI via `.lighthouserc.json`.
