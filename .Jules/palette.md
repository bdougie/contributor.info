## 2025-12-22 - Standardized Button Loading State
**Learning:** The codebase had multiple manual implementations of loading spinners inside buttons. Standardizing this into the Button component simplifies usage and ensures consistency.
**Action:** Use `isLoading` prop on `Button` instead of manually adding `Loader2` icons.

## 2026-01-27 - Clear Button for Search Input
**Learning:** Adding a clear button to search inputs significantly improves usability on mobile and desktop. When adding icons to input fields that already have other indicators (like loaders), dynamic positioning logic is required to prevent overlap while maintaining consistent padding.
**Action:** Implemented a clear button in `GitHubSearchInput` with dynamic positioning logic to coexist with the loading spinner.

## 2025-05-21 - Tooltips for Icon-Only Buttons
**Learning:** Icon-only buttons relying solely on `title` attributes provide poor accessibility and visual feedback. Replacing `title` with proper `Tooltip` components enhances both keyboard accessibility and visual polish.
**Action:** Replaced `title` attributes with `Tooltip` components in `ShareableCard` for Copy, Download, and Share actions.
