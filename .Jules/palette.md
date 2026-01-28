## 2025-12-22 - Standardized Button Loading State
**Learning:** The codebase had multiple manual implementations of loading spinners inside buttons. Standardizing this into the Button component simplifies usage and ensures consistency.
**Action:** Use `isLoading` prop on `Button` instead of manually adding `Loader2` icons.

## 2025-05-21 - Keyboard Shortcuts for Search
**Learning:** Adding standard keyboard shortcuts (like `/` for search) significantly improves navigability for power users without cluttering the UI.
**Action:** Added `Cmd+K` / `/` shortcut to the repository list search with a visual `<Kbd>` hint.
