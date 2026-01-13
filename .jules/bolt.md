## 2026-01-13 - Date Object Allocation in Loops
**Learning:** Creating `new Date()` objects inside tight loops (like filtering thousands of PRs) significantly impacts performance. ISO 8601 strings can be parsed faster using `Date.parse()` (or comparing timestamps directly), avoiding object allocation overhead.
**Action:** When filtering or sorting by date in large lists, convert reference dates to timestamps outside the loop and use `Date.parse()` or timestamp comparison inside the loop.

## 2025-12-22 - Window Virtualization for Grids
**Learning:** Implementing window-based virtualization for grids requires careful handling of the container's offset relative to the document. The virtualizer assumes items start at the top of the scroll container (window), so using `scrollMargin` equal to the container's offsetTop is crucial to align the virtual window with the actual items.
**Action:** When adding window virtualization to a component that isn't at the top of the page, always measure and pass the `scrollMargin` or offset to `useVirtualizer`.

## 2025-12-22 - Tailwind Dynamic Classes
**Learning:** Dynamic class generation (e.g., `grid-cols-${count}`) can lead to missing styles if the resulting class names are not explicitly safelisted or present elsewhere in the source code. Tailwind's JIT compiler purges unused classes.
**Action:** Always map dynamic values to full class name strings or ensure they are covered by safelists when building reusable components.

## 2024-05-23 - Activity Feed Performance Bottleneck
**Learning:** The `ActivityItem` component was performing O(N*M) calculations (filtering all PRs and comments) for every activity item rendered. Since the activity feed renders many items for the same user, this resulted in massive redundant computation (15x-20x slowdown for 50 items).
**Action:** Implemented a shared `WeakMap` cache for contributor activity counts keyed by the `pullRequests` array. This transforms the complexity from O(Activities * PRs) to O(PRs) (amortized constant time lookup per activity). Future list items should avoid inline heavy aggregations over the parent data context.
