## 2025-12-22 - Standardized Button Loading State
**Learning:** The codebase had multiple manual implementations of loading spinners inside buttons. Standardizing this into the Button component simplifies usage and ensures consistency.
**Action:** Use `isLoading` prop on `Button` instead of manually adding `Loader2` icons.

## 2025-05-21 - Accessible Loading Buttons
**Learning:** Loading states in buttons visualizes state but often lacks semantic announcement for screen readers. Using `aria-busy` and visually hidden text ensures all users understand the button is processing.
**Action:** Always include `aria-busy="true"` and `sr-only` text when a button is in a loading state.
