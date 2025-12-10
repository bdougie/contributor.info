# Radix UI Component Audit - Dec 2025

## Executive Summary

Audited all 27 Radix UI packages to identify unused components that could be removed to reduce bundle size.

**Finding**: 6 Radix UI packages have no usage in the codebase and can be safely removed.

## Audit Results

### 📦 Installed Packages: 27
All Radix UI packages are properly defined in UI component files.

### ✅ Used in Codebase: 21 packages
The following components are actively imported and used:
- Alert Dialog, Avatar, Button (via Slot), Breadcrumb (via Slot)
- Checkbox, Collapsible, Dialog, Dropdown Menu
- Hover Card (used in 4 places: PR hover, contributor hover, rising stars, file hover)
- Label, Popover, Progress, Radio Group
- Scroll Area, Select, Separator, Sheet (via Dialog), Slider
- Switch, Tabs, Toast, Toggle, Tooltip

### ❌ Unused Packages: 6

The following Radix packages are **not imported anywhere** in the codebase:

1. **@radix-ui/react-accordion**
   - UI component exists: `src/components/ui/accordion.tsx`
   - Usage: **0 imports found**
   - No Storybook stories

2. **@radix-ui/react-aspect-ratio**
   - UI component exists: `src/components/ui/aspect-ratio.tsx`
   - Usage: **0 imports found**
   - No Storybook stories

3. **@radix-ui/react-context-menu**
   - UI component exists: `src/components/ui/context-menu.tsx`
   - Usage: **0 imports found**
   - No Storybook stories

4. **@radix-ui/react-menubar**
   - UI component exists: `src/components/ui/menubar.tsx`
   - Usage: **0 imports found**
   - No Storybook stories

5. **@radix-ui/react-navigation-menu**
   - UI component exists: `src/components/ui/navigation-menu.tsx`
   - Usage: **0 imports found**
   - No Storybook stories

6. **@radix-ui/react-toggle-group**
   - UI component exists: `src/components/ui/toggle-group.tsx`
   - Usage: **0 imports found**
   - No Storybook stories

## Bundle Impact Estimate

Each Radix UI primitive is typically **3-8KB minified** (1-3KB gzipped):
- 6 packages × ~5KB average = **~30KB minified**
- Gzipped savings: **~10KB**

While not massive, this represents **free bundle size reduction** with zero risk since these components are completely unused.

## Recommendations

### Immediate Action (Low Risk)
Remove unused Radix packages and their wrapper components:

```bash
# 1. Remove packages
npm uninstall \
  @radix-ui/react-accordion \
  @radix-ui/react-aspect-ratio \
  @radix-ui/react-context-menu \
  @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-toggle-group

# 2. Remove wrapper components
rm src/components/ui/accordion.tsx
rm src/components/ui/aspect-ratio.tsx
rm src/components/ui/context-menu.tsx
rm src/components/ui/menubar.tsx
rm src/components/ui/navigation-menu.tsx
rm src/components/ui/toggle-group.tsx
```

### Verification Steps
1. Run full test suite: `npm test`
2. Build Storybook: `npm run build-storybook`
3. Build production: `npm run build`
4. Check bundle size difference in Netlify deploy preview

### Future Consideration
If any of these components are needed later:
- They're from shadcn/ui and can be easily re-added
- Documentation exists at ui.shadcn.com
- Re-installation takes ~30 seconds

## Related Work
- PR #1285: Established performance baseline (Dec 2025)
- Recent performance PRs: #1282 (lazy loading), #1281 (PostHog defer), #1275 (debouncing)

## Audit Methodology
1. Listed all 27 installed `@radix-ui/react-*` packages
2. Searched codebase for `from '@/components/ui/*'` imports
3. Cross-referenced UI component files with actual imports
4. Verified zero usage in both source and Storybook stories
5. Confirmed no test dependencies

---

**Audit Date**: 2025-12-09  
**Audited By**: Netlify Performance Auditor Agent  
**Risk Level**: Low (unused code removal only)
