## 2024-05-24 - Mobile Interactive Elements
**Learning:** Icon-only buttons on mobile interfaces (like FABs or toggle triggers) are easily overlooked for accessibility. Screen readers rely entirely on `aria-label` for these elements since they lack text content.
**Action:** Always verify `aria-label` is present on any `size="icon"` button, especially those hidden on desktop (`md:hidden`) which are often mobile-specific triggers.
