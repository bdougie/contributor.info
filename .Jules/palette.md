## 2025-12-22 - Standardized Button Loading State
**Learning:** The codebase had multiple manual implementations of loading spinners inside buttons. Standardizing this into the Button component simplifies usage and ensures consistency.
**Action:** Use `isLoading` prop on `Button` instead of manually adding `Loader2` icons.

## 2026-01-19 - Orphaned Labels on Custom Inputs
**Learning:** Custom input components (like `GitHubSearchInput`) often lack `id` prop forwarding, leading to orphaned labels in parent forms. This prevents users from focusing the input by clicking the label.
**Action:** Ensure custom input wrappers accept and forward `id` props to the underlying native input element, and always associate labels using `htmlFor`.
