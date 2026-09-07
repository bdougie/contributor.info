# Pre-merge performance checklist

Every item here can be checked by a command, a lint rule, or a CI job. If you want to add an item that cannot, add the tool first.

## Before you start

- [ ] Record the baseline: `npm run lighthouse:mobile` against the route, or the route's p75 LCP from RUM. Paste the number and the command in the PR.
- [ ] Trace the route's critical path (see `progressive-loading.md#tracing-a-route`). List what will change.

## New code on an existing route

- [ ] Any new `useEffect` at the app root or layout level that does network or imports a library is wrapped in `runWhenIdle` or gated on interaction. Verify with `grep -n "useEffect" src/App.tsx` and read each one.
- [ ] Any new static import in the entry graph is one of the preload-allowlisted chunks. Check `dist/index.html` `modulepreload` links after `npm run build`.
- [ ] New fetches on the initial path go through the shared dedup/lookup helper. Network tab shows no duplicate requests before the first list request.
- [ ] New fetches have a `limit`.
- [ ] New loading states read their cache in the `useState` initializer. Remount the component (tab away and back) and confirm no loading frame.
- [ ] New status or error banners are debounced. Warm load shows no flash.
- [ ] New sections that replace a skeleton have the skeleton's height. Lighthouse CLS on the route unchanged.
- [ ] New charts or editors are behind `React.lazy` inside an intersection-gated wrapper, and their library has its own chunk that is not preloaded.
- [ ] New vendor SDKs load on first interaction with a timed fallback.
- [ ] New images have `width`, `height`, `alt`, and `loading="lazy"` unless above the fold.

## Build

- [ ] `npm run build` prints no new chunk in the preload set.
- [ ] No chunk grew past the CI gate (`MAX_KB`). The bundle-size step in CI ran and printed a non-empty table.
- [ ] Any new dependency whose name contains `react` has an explicit `manualChunks` line above the React test, or is dynamic-imported.
- [ ] `ANALYZE=true npm run build` shows the new dependency in the chunk you intended.

## Verify

- [ ] Lighthouse CI on the PR is green at error level for the landing route and no worse at warn level for the changed route.
- [ ] Re-run the baseline command. Paste the after number next to the before number.
- [ ] If the change was meant to improve a number and did not, say so in the PR and either keep it for another reason or revert.

## Docs

- [ ] Any doc touched cites file:line for the mechanism and contains no size or timing numbers.
- [ ] Any npm script, route, or path named in the doc exists (`grep` it).
- [ ] If the change reverses a postmortem's conclusion, the postmortem gets a dated "Superseded" note at the top.
