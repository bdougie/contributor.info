# Progressive loading

A page loads progressively when each stage renders something truthful and stable, and the next stage only refines it. The stages, in the order the browser meets them:

| Stage | Source | What the user sees |
|---|---|---|
| 0. Response | Edge/server HTML | The real header and whatever data the edge can fetch in one round trip, or a correctly shaped skeleton |
| 1. Hydrate | Same DOM | Nothing changes. The Suspense fallback returns `null` |
| 2. First render | In-memory caches | Final state on warm navigations; skeletons with reserved heights on cold ones |
| 3. First data | One deduped, limited read | Content fills in. Status banners are held back so fast hits never flash |
| 4. Idle | `requestIdleCallback` | Background sync triggers, RUM, prefetch. Invisible |
| 5. Scroll | IntersectionObserver | Charts and heavy sections mount as they approach the viewport |
| 6. Interaction | First input or 5s | Vendor SDKs. Session replay much later |
| 7. Later | Timer + idle | Background job queues, polling, notifications |

Everything below is a snippet you can drop into a React + Vite app. Adapt names; keep the shape.

## Tracing a route

Before changing anything, answer these for the specific route:

1. What is the LCP element? (Lighthouse names it. Usually the H1 or hero image.)
2. What HTML does the first response contain? View source, not DevTools. If it is an empty `<div id="root">`, stage 0 is missing.
3. Which chunks are `<link rel="modulepreload">` in that HTML? Are all of them needed to paint the LCP element?
4. What is the first data request, and how many requests does the page make before it? Count duplicates.
5. Which components mount at first render and which are behind `React.lazy`? Are any lazy ones actually above the fold?
6. What runs in `useEffect` on mount at the app root? List every dynamic import and timer.
7. Which of those can move to idle, to intersection, or to first interaction?

Write the answers down with file:line. That list is the plan.

## Stage 0: SSR shell with safe inline data

An edge function renders the route with the minimum data one round trip can fetch, then inlines that data so the client does not fetch it again.

```ts
// edge function
const [assets, entity, stats] = await Promise.all([
  getAssetManifest(),
  fetchEntity(id),
  fetchStats(id),
]);
if (assets.failed) return fallbackToSPA();          // never risk a hydration mismatch
const body = entity ? renderContent(entity, stats) : renderSkeleton(id); // 404 still paints the shape
return new Response(html(body, assets, inlineData(entity)), {
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    'X-SSR-Rendered': 'true',
  },
});
```

Inlining JSON into a `<script>` safely:

```ts
function inlineData(payload: object): string {
  // 1. stringify  2. escape < so "</script>" cannot break out  3. stringify again to get a JS string literal
  const safe = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<script>window.__ENTITY_SSR__ = JSON.parse(${JSON.stringify(safe)});</script>`;
}
```

Client side, consume it once and delete it, matching case-insensitively if the identifier is:

```ts
function consumeSSREntity(id: string): Entity | null {
  const payload = window.__ENTITY_SSR__;
  if (!isEntity(payload) || payload.id.toLowerCase() !== id.toLowerCase()) return null;
  delete window.__ENTITY_SSR__;   // SPA navigation to another entity must not reuse it
  return payload;
}
```

Keep the SSR payload minimal (identity, timestamps, a few counts). The client's normal fetch fills the rest and the SSR row seeds the cache so that fetch is not blocked on a lookup.

## Stage 1: hydration-aware Suspense fallback

```tsx
// main.tsx
if (shouldHydrate()) {                       // #root has content and an SSR marker
  hydrateRoot(root, <App />, { onRecoverableError: logWarn });
  runWhenIdle(() => markHydrationComplete());
} else {
  createRoot(root).render(<App />);
}
```

```tsx
// App.tsx — the ONLY Suspense boundary around routes
import { RouteSkeleton } from './skeletons/route-skeleton'; // eager import: the fallback must never suspend

function PageFallback() {
  if (isSSRPage() && !isHydrationComplete()) return null;   // keep the SSR DOM
  return matchesEntityRoute(window.location.pathname)       // synchronous: no router context here
    ? <RouteSkeleton />
    : <GenericSkeleton />;
}

<Suspense fallback={<PageFallback />}><Routes>…</Routes></Suspense>
```

Ambient UI (command palettes, chat panels, toasts) gets `<Suspense fallback={null}>` so it never shows a skeleton.

The route matcher in the fallback cannot use `useParams`. It parses the pathname with an exclusion list of static two-segment routes. That list will also exist in your edge config. Keep them adjacent in the codebase and comment the pairing.

## Stage 2: cache-seeded state

```ts
const cache = new Map<string, { value: Data; timestamp: number }>();
const TTL = 5 * 60 * 1000;

export function useEntityData(key: string) {
  const hit = cache.get(key);
  const fresh = hit !== undefined && Date.now() - hit.timestamp < TTL;

  // Read the cache in the initializer, not in an effect: an effect still paints one loading frame.
  const [state, setState] = useState<State>(
    fresh ? { data: hit.value, loading: false } : { data: null, loading: true }
  );
  …
}
```

Design the cache key around what requires a network call. A UI toggle that is pure post-processing (a bot filter, a sort) does not belong in the key; recompute from the cached rows.

If the app already has React Query, use it with `staleTime` equal to the TTL and `initialData` from `queryClient.getQueryData`, and defer `persistQueryClient` to idle. A hand-rolled module cache is acceptable only where React Query is not already provided.

## Stage 3: one read, deduped, limited, with background refresh on idle

```ts
export function getEntity(id: string): Promise<Entity | null> {
  const cached = lookups.get(id);
  if (cached && Date.now() - cached.timestamp < TTL) return cached.promise;

  const ssr = consumeSSREntity(id);
  if (ssr) { const p = Promise.resolve(ssr); lookups.set(id, { promise: p, timestamp: Date.now() }); return p; }

  const promise = queryEntity(id).then((row) => {
    if (row === null) lookups.delete(id);   // misses are not cached: creation flows poll for the row to appear
    return row;
  }).catch((err) => { lookups.delete(id); throw err; });
  lookups.set(id, { promise, timestamp: Date.now() });   // concurrent callers share the in-flight promise
  return promise;
}
```

Then the page's data function:

```ts
const [rows, extras] = await Promise.all([fetchRows(id, { limit: 500 }), fetchExtras(id)]);
const stale = rows.length === 0 || Date.now() - lastUpdated > 6 * 3600e3;
if (stale) runWhenIdle(() => triggerBackgroundSync(id).catch(logWarn)); // fire-and-forget never blocks LCP
return { rows, extras, status: rows.length ? 'success' : 'pending' };
```

Offer a `mode: 'basic' | 'full'` column selection so list views do not pull bodies and diffs.

## Stage 4: idle deferral helper

```ts
export function runWhenIdle(
  cb: () => void,
  { timeout = 2000, fallbackDelay = 100 } = {}
): () => void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => cb(), { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, fallbackDelay);   // Safari
  return () => clearTimeout(id);
}
```

Use it for: query persistence setup, RUM init, prefetch, sync triggers, feature-flag fetches for below-the-fold UI, hydration-complete marking.

## Stage 3b: debounced status banners and reserved heights

```tsx
const [showStatus, setShowStatus] = useState(false);
useEffect(() => {
  const shouldShow = !loading && status !== 'success';
  if (!shouldShow) { setShowStatus(false); return; }
  const t = setTimeout(() => setShowStatus(true), 800);
  return () => clearTimeout(t);
}, [loading, status]);
```

Pair with reserved space so the layout does not move when the banner or timestamp arrives:

```tsx
<div className="h-5">{timestamp ? <LastUpdated at={timestamp} /> : <span className="skeleton" />}</div>
```

Give skeletons the exact height of the component they stand in for. Render real text (the entity name from the URL) in skeleton breadcrumbs and headers instead of gray bars.

## Stage 5: intersection-gated heavy components

```tsx
export function ProgressiveSection({ skeleton, children, priority = false, rootMargin = '100px' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(priority);
  useEffect(() => {
    if (priority || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [priority, rootMargin]);
  return <div ref={ref}>{visible ? <Suspense fallback={skeleton}>{children}</Suspense> : skeleton}</div>;
}
```

Charts go inside with `React.lazy`. Keep chart libraries in their own chunks and out of the preload allowlist.

## Stage 6: vendor SDKs on first interaction

```ts
useEffect(() => {
  let loaded = false;
  const load = () => {
    if (loaded) return; loaded = true;
    import('./vendor-lazy').then(({ init, enableReplay }) => {
      init().then(() => setTimeout(enableReplay, 30_000));   // replay libs are heavy; nobody needs them at 0s
    });
    events.forEach((e) => document.removeEventListener(e, load));
  };
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
  events.forEach((e) => document.addEventListener(e, load, { once: true, passive: true }));
  const fallback = setTimeout(load, 5000);   // count the users who never interact
  return () => { events.forEach((e) => document.removeEventListener(e, load)); clearTimeout(fallback); };
}, []);
```

Start RUM with a provider you own (your database, a tiny beacon endpoint) at idle, and add the vendor as a second provider when it loads. You get vitals for every session, not just the ones that lived long enough for the SDK.

## Stage 7: background systems

Load background queues, notification checkers, and pollers after a fixed delay (5s is common) and then on idle. Let them self-initialize on import so the app root only does `import()`. If such a module needs to react to client-side navigation and sits outside the router, prefer subscribing to the router's history object over monkey-patching `history.pushState`.

## What this looks like when it is wrong

- The first response is an empty root div, and the first paint is a skeleton that gets replaced by another skeleton.
- Switching tabs and back shows a loading spinner for 200ms.
- A "Setting things up..." banner flashes on every warm load.
- Network tab shows the same entity lookup 4 times before the first list request.
- A 100KB analytics bundle is in the modulepreload list.
- The chart library loads on a route with no charts because a shared util was hoisted into its chunk.
