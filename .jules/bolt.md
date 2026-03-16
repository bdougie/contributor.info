## 2026-01-13 - Decoupled Data Fetching from View Filtering
**Learning:** Including view filters (like `includeBots`) in data fetching cache keys can cause unnecessary network requests when the user toggles the filter. If the filter only applies to post-processing (e.g. `calculateLotteryFactor`), it should be applied on the cached data instead.
**Action:** When designing hooks that fetch and process data, separate the fetch parameters (cache key) from the processing parameters. On cache hit, re-apply the processing logic with the current parameters.

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

## 2025-03-03 - OptimizedAvatar for GitHub Avatars
**Learning:** Using the native `Avatar` and `AvatarImage` components from `shadcn/ui` for GitHub avatars can lead to performance issues because GitHub serves the original size image unless query parameters are used. The `OptimizedAvatar` component automatically resizes the image based on the size prop, saving bandwidth and improving load times.
**Action:** Always use the `OptimizedAvatar` component instead of `AvatarImage` when rendering user avatars, especially in lists or grids.

## 2026-01-14 - Date Comparison Performance
**Learning:** `String.prototype.localeCompare` and `Date.parse()` are slow compared to native string comparison operators (`<`, `>`). Since ISO 8601 strings sort correctly with these operators, using them instead of creating `Date` objects or using `localeCompare` is much faster.
**Action:** When comparing dates in tight loops, use native string comparison operators (`<`, `>`) instead of `new Date().getTime()`, `Date.parse()`, or `localeCompare()`.

## 2026-03-16 - Bolt Optimization: String Comparison for ISO 8601 Dates
**Learning:** In tight loops mapping over large sets of items (like thousands of pull requests in `ContributionsChart`), allocating `new Date()` objects solely to get timestamps for comparison or math can incur noticeable overhead. `Date.parse()` avoids allocating `Date` objects and directly returns a primitive number, which is faster. However, for direct sorting of ISO 8601 strings, native string comparison operators (`<`, `>`) are even faster than both `Date.parse()` and `localeCompare()`. Additionally, values that do not depend on the loop iteration, such as `Date.now()`, should always be computed once prior to the loop.
**Action:** When filtering, mapping, or sorting over large datasets by date using ISO 8601 strings:
1.  Compute static reference timestamps (like `Date.now()`) outside the loop.
2.  Use string comparison (`a.created_at < b.created_at`) to sort dates directly.
3.  Use `Date.parse()` instead of `new Date().getTime()` to retrieve numerical timestamps when arithmetic operations are needed inside the loop.
