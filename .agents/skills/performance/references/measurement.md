# Measurement and gating

If it is not measured the same way twice, it is an anecdote. If it is measured but nothing fails when it regresses, it is a wish.

## Lab: Lighthouse CI

Config shape that has held up:

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "NO_COLOR=1 npx vite preview --outDir .lighthouse-build",
      "startServerReadyPattern": "Local",
      "url": ["http://localhost:4173/", "http://localhost:4173/some/entity"],
      "numberOfRuns": 3,
      "settings": {
        "formFactor": "mobile",
        "screenEmulation": { "mobile": true, "width": 412, "height": 823, "deviceScaleFactor": 1.75, "disabled": false },
        "throttlingMethod": "simulate",
        "throttling": { "rttMs": 150, "throughputKbps": 1638.4, "cpuSlowdownMultiplier": 4 }
      }
    },
    "assert": {
      "assertMatrix": [
        {
          "matchingUrlPattern": "^http://localhost:4173/?$",
          "assertions": {
            "largest-contentful-paint": ["error", { "maxNumericValue": 4000 }],
            "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
            "resource-summary:script:size": ["error", { "maxNumericValue": 600000 }],
            "resource-summary:total:size": ["error", { "maxNumericValue": 2000000 }],
            "categories:performance": ["error", { "minScore": 0.8 }]
          }
        },
        {
          "matchingUrlPattern": "^http://localhost:4173/some/entity$",
          "assertions": {
            "largest-contentful-paint": ["warn", { "maxNumericValue": 4000 }],
            "cumulative-layout-shift": ["warn", { "maxNumericValue": 0.1 }],
            "categories:performance": ["warn", { "minScore": 0.75 }]
          }
        }
      ]
    }
  }
}
```

Notes:

- Audit the routes that matter, including one data-heavy entity route, not just `/`.
- Error-level on the landing route, warn-level on the rest until three consecutive weeks are green. Then promote. A flaky error gate gets disabled.
- Three runs, mobile, 4x CPU. Desktop numbers hide everything.
- Build into a directory other than `dist/` (or move it) so LHCI does not auto-detect a static dir and skip your `startServerCommand`.
- Trigger on `src/**`, the bundler config, `index.html`, and `package.json`. Not on docs.

Local equivalents to keep in `package.json`:

```json
"lighthouse": "lighthouse http://localhost:4173 --output json --output html --output-path ./lighthouse-reports/report --chrome-flags=\"--headless\"",
"lighthouse:mobile": "lighthouse http://localhost:4173 --preset=perf --form-factor=mobile --throttling.cpuSlowdownMultiplier=4 --output json --output html --output-path ./lighthouse-reports/mobile-report --chrome-flags=\"--headless\""
```

## Field: real-user monitoring, tagged by route

Use the `web-vitals` package. Report to something you own first; add the vendor SDK later as a second sink.

```ts
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

const thresholds = { LCP: 2500, INP: 200, CLS: 0.1, FCP: 1800, TTFB: 800 };
const rate = (name, v) => (v <= thresholds[name] ? 'good' : v <= thresholds[name] * 1.5 ? 'needs-improvement' : 'poor');

function report(metric) {
  const path = location.pathname;
  sink.send({
    name: metric.name, value: metric.value, rating: rate(metric.name, metric.value),
    route: routePattern(path),              // '/:owner/:repo', not the concrete path, so p75 groups
    entity: extractEntity(path),            // the concrete owner/repo, for drill-down
    connection: navigator.connection?.effectiveType,
    ts: Date.now(),
  });
}
[onLCP, onINP, onCLS, onFCP, onTTFB].forEach((fn) => fn(report));
```

Initialize it on idle. Then build one dashboard: p75 LCP per route pattern, weekly. That single chart tells you which route to work on next and whether the last change did anything.

## Bundle size gate that actually runs

The common failure: a workflow greps Vite's build log for `dist/assets/…` after the config moved output to `dist/js/`, or greps for "larger than 600 kB" after `chunkSizeWarningLimit` was raised. Both pass forever.

Parse the files, not the log:

```bash
# fails if any JS chunk exceeds MAX_KB, prints a table either way
MAX_KB=${MAX_KB:-600}
fail=0
printf '| Chunk | KB | gzip KB |\n|---|---:|---:|\n'
for f in dist/js/*.js; do
  kb=$(( $(wc -c < "$f") / 1024 ))
  gz=$(( $(gzip -c "$f" | wc -c) / 1024 ))
  printf '| %s | %s | %s |\n' "$(basename "$f")" "$kb" "$gz"
  [ "$kb" -gt "$MAX_KB" ] && { echo "::error::$f is ${kb}KB (> ${MAX_KB}KB)"; fail=1; }
done
exit $fail
```

Make the output directory a single variable that the bundler config and this script both read, or at least add a test that `ls dist/js/*.js` is non-empty so a moved directory fails loudly.

Comment the table on the PR with an idempotent marker (`<!-- bundle-size -->`) so reruns update one comment.

## Chunk-graph gate

Size caps miss the more common regression: a route chunk that starts statically importing a vendor chunk it never uses, because a shared helper got hoisted there. Assert the graph, not just the sizes. Read each built chunk, collect its `import ... from "./x"` targets, and fail on a deny-list:

```js
const DENY = [
  { chunk: 'index-',          mustNotImport: ['vendor-ai-sdk', 'vendor-recharts', 'vendor-zod'] },
  { chunk: 'workspace-page-', mustNotImport: ['vendor-ai-sdk', 'vendor-recharts', 'vendor-zod'] },
];
for (const c of chunks) for (const rule of DENY) if (c.file.startsWith(rule.chunk))
  for (const v of rule.mustNotImport) if (c.imports.some((i) => i.startsWith(v))) fail(`${c.file} imports ${v}`);
```

contributor.info's version is `scripts/performance/check-chunk-graph.mjs` (size table, per-chunk cap, deny-list, `--summary` for the job summary). Run it in the same job as the build so the table is never empty.

## Slow-network testing

Keep a script that runs the app under DevTools-style throttling for Slow 3G / Fast 3G / 2G and records time to first meaningful content per route. The 2G number is where serial fetch waterfalls become visible: 15 sequential requests at 2s RTT is 30s of nothing. Use it when adding any fetch to a route's initial path.

## Unit-level guards

- A test that imports the app entry and asserts no module in a deny-list (analytics, charts, markdown) is in the static import graph. Cheap, catches the "someone added a static import" regression.
- A test that renders the Suspense fallback with the SSR marker present and asserts it returns `null`.
- A test that the `runWhenIdle` fallback path fires when `requestIdleCallback` is undefined.

Delete `it.skip` performance tests. A skipped test is documentation that lies.

## Writing perf docs that stay true

- Cite file and line for every mechanism. Readers can verify; rot is detectable.
- Quote live config in fenced blocks and say which file it came from. Never paraphrase `manualChunks`.
- No kB tables, no percentages, no "Lighthouse went from 65 to 82". Link the dashboard or the CI run instead.
- Postmortems are history. When a later change reverses their conclusion, add a dated "Superseded" note at the top pointing at the new config. Do not edit the body.
- Delete "Next steps" sections once the steps ship, or the doc claims SSR is future work three years after it landed.
- If a doc names an npm script, a route, or a file, grep for it before merging the doc. An audit pass every quarter with a script that extracts backticked paths and checks they exist is cheap.
