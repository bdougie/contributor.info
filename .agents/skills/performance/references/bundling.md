# Bundling and chunking (Vite / Rollup)

Chunking is second-order. Removing work from the critical path and serving an SSR shell move LCP far more than any `manualChunks` rearrangement. Do chunking last, and only with a build report in hand.

## Decide with a report, not intuition

```bash
ANALYZE=true npm run build   # rollup-plugin-visualizer, opt-in, emits dist/stats.html
```

Load the visualizer plugin with a dynamic import guarded by the env flag so production builds that prune devDependencies do not fail:

```ts
plugins: [
  react(),
  ...(process.env.ANALYZE ? [(await import('rollup-plugin-visualizer')).visualizer({ filename: 'dist/stats.html', gzipSize: true })] : []),
]
```

Questions the report answers: which chunk is in the preload set that should not be, which vendor is duplicated across chunks, and which app module dragged a vendor into the entry.

## `manualChunks` as a function: order the tests

Substring tests on module ids are order-sensitive. Put the exceptions first.

```ts
manualChunks: (id) => {
  if (!id.includes('node_modules')) return;                 // never split app code by hand
  if (id.includes('@sentry')) return;                       // '@sentry/react' contains 'react/'; let Vite split it (it is dynamic-imported)
  if (id.includes('@ai-sdk') || id.includes('/node_modules/ai/')) return 'vendor-ai-sdk'; // same substring trap
  if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router')) return 'vendor-react-core';
  if (id.includes('@radix-ui')) return 'vendor-ui';
  if (id.includes('recharts')) return 'vendor-recharts';
  if (id.includes('@supabase')) return 'vendor-supabase';
  if (['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns'].some((m) => id.includes(m))) return 'vendor-utils';
  if (id.includes('posthog-js')) return 'vendor-analytics';
  if (id.includes('web-vitals')) return 'vendor-vitals';
  // markdown toolchains (react-markdown, remark, rehype): NOT chunked here. Manual chunking hoisted shared
  // helpers into vendor-markdown, other chunks then depended on it, and it loaded eagerly everywhere.
  // A React.lazy boundary around the markdown component splits it correctly.
},
```

Rules:

- **Test the narrow pattern before the broad one.** Every package whose name contains `react` needs a line above the React test or it lands in the core chunk. Grep `node_modules` for `*react*` after adding a dependency.
- **Do not manually chunk anything that is already behind a dynamic `import()`.** Rollup splits it correctly on its own; a manual chunk can merge it with something eager.
- **Do not chunk toolchains with many small shared helpers** (markdown, syntax highlighting, i18n). The helpers get hoisted into the vendor chunk, other chunks import them, and the whole chunk becomes eager.
- **Do not split app code by hand.** Route-level `React.lazy` is the only app-code splitting that pays off. Hand-made `app-admin` / `app-charts` chunks produce `Cannot access 'X' before initialization` when a context or `forwardRef` crosses the boundary.
- **Pin shared transitive dependencies before the vendor that dominates them.** When two vendors share a dependency (zod under both an AI SDK and a job-queue SDK; `@opentelemetry/api` under both), Rollup tends to hoist the shared module into whichever manual chunk imports it most. Every other importer then statically pulls that whole vendor chunk. Symptom: a route chunk shows `import "./vendor-ai-sdk-…"` with no AI feature. Fix: `if (id.includes('/node_modules/zod/')) return 'vendor-zod';` above the vendor test, and add a chunk-graph assertion so it cannot come back (see `measurement.md#chunk-graph-gate`).
- **Do not trust an old postmortem over a working config.** A failed split from a year ago proves the ordering then was wrong, not that the split is impossible. Re-test; keep the new constraints as comments in the config, with the issue number.

## Preload allowlist

Vite emits `<link rel="modulepreload">` for every chunk the entry statically imports. Filter that to what the LCP element needs, ordered by need:

```ts
build: {
  modulePreload: {
    polyfill: true,
    resolveDependencies: (_, deps) => {
      const priority = ['vendor-react-core', 'index-', 'vendor-utils'];
      const rank = (d: string) => { const i = priority.findIndex((p) => d.includes(p)); return i === -1 ? priority.length : i; };
      return deps
        .sort((a, b) => rank(a) - rank(b))
        .filter((d) =>
          d.includes('vendor-react-core') ||
          d.includes('vendor-utils') ||
          d.includes('vendor-supabase') ||   // on every route's critical path; without a hint the browser finds it a round-trip late
          d.includes('vendor-ui') ||
          (d.includes('index-') && !d.includes('charts-'))
        );
    },
  },
}
```

Anything excluded here (charts, markdown, analytics, ML runtimes) loads when its `import()` runs. Verify by viewing the built `index.html`, not the dev server.

## Other build settings that matter

- `sourcemap: false` in production unless you upload them somewhere. 15MB of maps in `dist/` has broken CI uploads.
- `esbuild.drop: ['console', 'debugger']` in production.
- `cssCodeSplit: true`. Keep one CSS entry per lazy route.
- `assetsInlineLimit: 4096`. Larger inlined assets bloat the entry.
- `treeshake.moduleSideEffects: false` only if every dependency is honest about side effects; test the build.
- `chunkSizeWarningLimit` is a warning threshold, not a budget. If CI greps Vite's warning string to enforce a budget, changing this number silently disables the gate. Assert on parsed sizes instead (see `measurement.md`).

## Host post-processing interlock

Netlify, Cloudflare Pages, and similar hosts offer post-build bundling and minification. With Vite output, turn it off:

```toml
[build.processing.js]
  bundle = false
  minify = false
```

It reorders module initialization and produces `Cannot read properties of undefined (reading 'forwardRef')` in production only. Keep the setting next to the compression doc so nobody removes it "because Vite already minifies".

## Long-lived caching for hashed assets

Content-hashed filenames get `Cache-Control: public, max-age=31536000, immutable`. The HTML entry and SSR responses get short `s-maxage` plus `stale-while-revalidate`. Never document a curl against an unhashed filename like `/js/index.js`; it will not exist.

## Lazy wrappers: when they earn their keep

A `Component-lazy.tsx` file that wraps `React.lazy` + `Suspense` + a skeleton is worth it when the component is:

- below the fold or behind a user action (dialogs, sheets, command palettes, galleries, carousels), or
- heavy because of its own imports (charts, editors, markdown), or
- admin-only or rarely visited.

It is not worth it for anything visible at first paint on the route that owns it. Each wrapper adds a request and a suspense boundary. Audit `*-lazy.tsx` files periodically: any with zero consumers should go.

## Lazy vendor clients

For SDKs that many modules import (a database client, an error tracker):

```ts
// client-lazy.ts
let instance: Client | null = null;
export function setClientInstance(c: Client) { instance = c; }
export async function getClient(): Promise<Client> {
  if (instance) return instance;
  const mod = await import('./client');   // creates and registers the instance on load
  return mod.client;
}
```

This only defers the SDK for modules that import the lazy accessor. One static `import { client } from './client'` anywhere on the initial path pulls the whole chunk eagerly. Grep for static imports before claiming the SDK is lazy, and if the SDK is genuinely needed for the first data fetch, put it in the preload allowlist and stop pretending.
