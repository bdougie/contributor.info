# React Router v7 Future Flags Migration

**Date:** 2025-11-15  
**Status:** ✅ Completed  
**Issue:** [#1189](https://github.com/bdougie/contributor.info/issues/1189)

## Overview

Added React Router v7 future flags to prepare the codebase for the upcoming React Router v7 release and eliminate console warnings.

## Changes Made

### 1. Main Application Router (`src/App.tsx`)

Added future flags to the main `Router` component:

```tsx
<Router
  future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }}
>
```

### 2. Test Utilities (`src/components/__tests__/test-utils.tsx`)

Created a reusable `TestRouter` component with future flags enabled:

```tsx
export function TestRouter({ children }: { children: ReactNode }) {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {children}
    </Router>
  );
}
```

### 3. Updated All Test Files

Updated the following test files to use `TestRouter`:
- `src/components/__tests__/login-required-for-search.test.tsx`
- `src/components/common/layout/__tests__/home.test.tsx`
- `src/pages/__tests__/demo-workspace-page.test.tsx`

### 4. Updated All Storybook Stories

Updated all story files to use `TestRouter`:
- `src/components/navigation/CommandPalette.stories.tsx`
- `src/components/common/layout/home.stories.tsx`
- `src/components/features/workspace/WorkspaceCreateModal.stories.tsx`
- `src/components/features/workspace/WorkspaceOnboarding.stories.tsx`
- `src/pages/workspace-page.stories.tsx`
- `src/pages/workspace-add-contributors.stories.tsx`

## Future Flags Explained

### `v7_startTransition: true`

- Wraps state updates in `React.startTransition`
- Enables better concurrent rendering support
- Prevents blocking UI updates during navigation

### `v7_relativeSplatPath: true`

- Changes relative route resolution within splat routes
- Improves predictability of nested route matching
- Aligns with standard relative path behavior

## Testing

- ✅ All console warnings eliminated
- ✅ All existing routes continue to work
- ✅ Splat routes tested and verified
- ✅ Test suite passes without warnings
- ✅ Storybook builds without warnings

## Benefits

1. **Proactive Migration**: Ready for React Router v7 when released
2. **Cleaner Console**: No more future flag warnings
3. **Better Performance**: Concurrent rendering optimizations enabled
4. **Consistent Testing**: All tests and stories use the same router configuration

## Breaking Changes

None. This is a backward-compatible change that prepares for v7.

## References

- [React Router v6 → v7 Migration Guide](https://reactrouter.com/v6/upgrading/future)
- [React Router Future Flags Documentation](https://reactrouter.com/v6/upgrading/future)
- Original Issue: #1189

## Next Steps

When React Router v7 is released:
1. Upgrade to `react-router-dom@7.x`
2. Remove the `future` prop (flags become default)
3. Verify all routes still work as expected
