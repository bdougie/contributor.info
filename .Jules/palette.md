## 2025-12-22 - Standardized Button Loading State
**Learning:** The codebase had multiple manual implementations of loading spinners inside buttons. Standardizing this into the Button component simplifies usage and ensures consistency.
**Action:** Use `isLoading` prop on `Button` instead of manually adding `Loader2` icons.

## 2026-01-27 - Clear Button for Search Input
**Learning:** Adding a clear button to search inputs significantly improves usability on mobile and desktop. When adding icons to input fields that already have other indicators (like loaders), dynamic positioning logic is required to prevent overlap while maintaining consistent padding.
**Action:** Implemented a clear button in `GitHubSearchInput` with dynamic positioning logic to coexist with the loading spinner.

## 2026-02-05 - Search Clear Button Accessibility
**Learning:** Icon-only buttons (like clear search) are often inaccessible due to missing tooltips and focus rings. Removing `outline` without providing `focus-visible` alternatives hurts keyboard navigation.
**Action:** Always wrap icon-only buttons in `Tooltip` and use `focus-visible` ring utilities to ensure they are discoverable and accessible.
