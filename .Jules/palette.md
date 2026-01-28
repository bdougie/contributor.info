## 2025-12-22 - Standardized Button Loading State
**Learning:** The codebase had multiple manual implementations of loading spinners inside buttons. Standardizing this into the Button component simplifies usage and ensures consistency.
**Action:** Use `isLoading` prop on `Button` instead of manually adding `Loader2` icons.

## 2025-12-23 - Input Keyboard Shortcuts
**Learning:** `GitHubSearchInput` can now display a keyboard shortcut hint (e.g., `⌘K`) using the `globalShortcut` prop, which also registers the global key listener.
**Action:** Use `globalShortcut` prop on `GitHubSearchInput` to enable keyboard activation and visual hints.
