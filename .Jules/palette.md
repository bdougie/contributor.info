## 2025-12-22 - Standardized Button Loading State
**Learning:** The codebase had multiple manual implementations of loading spinners inside buttons. Standardizing this into the Button component simplifies usage and ensures consistency.
**Action:** Use `isLoading` prop on `Button` instead of manually adding `Loader2` icons.

## 2026-01-23 - Reused CopyButton for Consistency
**Learning:** Several components manually implemented copy-to-clipboard functionality with custom buttons and toast notifications. Using the reusable `CopyButton` standardizes the UI (icon changes to checkmark), behavior (toast), and accessibility (aria-labels).
**Action:** Replace manual copy implementations with `<CopyButton />`.
