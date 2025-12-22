## 2025-12-22 - Window Virtualization for Grids
**Learning:** Implementing window-based virtualization for grids requires careful handling of the container's offset relative to the document. The virtualizer assumes items start at the top of the scroll container (window), so using `scrollMargin` equal to the container's offsetTop is crucial to align the virtual window with the actual items.
**Action:** When adding window virtualization to a component that isn't at the top of the page, always measure and pass the `scrollMargin` or offset to `useVirtualizer`.

## 2025-12-22 - Tailwind Dynamic Classes
**Learning:** Dynamic class generation (e.g., `grid-cols-${count}`) can lead to missing styles if the resulting class names are not explicitly safelisted or present elsewhere in the source code. Tailwind's JIT compiler purges unused classes.
**Action:** Always map dynamic values to full class name strings or ensure they are covered by safelists when building reusable components.
