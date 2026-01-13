## 2024-05-24 - Icon-only Button Accessibility Pattern
**Learning:** Icon-only buttons in this codebase sometimes rely solely on the `title` attribute for context, which is insufficient for screen reader users and touch devices. The `Tooltip` component is available and should be used instead.
**Action:** When identifying icon-only buttons (often `size="icon"` or just containing an icon), replace `title` attributes with a wrapped `Tooltip` component and explicit `aria-label` on the button itself.
