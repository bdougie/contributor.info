## 2026-01-06 - useLayoutEffect Performance Impact
**Learning:** Replacing `dangerouslySetInnerHTML` with `useLayoutEffect` for dynamic style injection caused a 7-point Lighthouse performance drop (92→85) because `useLayoutEffect` runs synchronously and **blocks browser paint**. This blocking work directly impacts Total Blocking Time (TBT) metric.
**Solution:** Use `createPortal` from `react-dom` to render `<style>` elements into `document.head` with callback refs setting `textContent`. This maintains XSS security while avoiding paint-blocking: `createPortal(<style ref={el => el && (el.textContent = styles)} />, document.head)`.
**Rule:** For dynamic style injection that must be secure: avoid `useLayoutEffect` DOM manipulation. Prefer `createPortal` + callback ref pattern which is non-blocking but still synchronous enough to prevent FOUC.

## 2024-05-24 - Mobile Interactive Elements
**Learning:** Icon-only buttons on mobile interfaces (like FABs or toggle triggers) are easily overlooked for accessibility. Screen readers rely entirely on `aria-label` for these elements since they lack text content.
**Action:** Always verify `aria-label` is present on any `size="icon"` button, especially those hidden on desktop (`md:hidden`) which are often mobile-specific triggers.
