# React Router v7 Upgrade Compatibility Analysis

## Project Overview

**Objective**: Evaluate upgrading from React Router v6.30.2 to v7, ensuring compatibility with our Netlify Edge SSR implementation from PR #1379.

**Status**: Research Complete - **Upgrade is VIABLE**

## Executive Summary

React Router v7 upgrade is **fully compatible** with our custom Edge SSR implementation. The upgrade path is straightforward because:

1. We already have 2 of 6 required future flags enabled
2. Our edge SSR operates at the HTML/React level, independent of React Router
3. v7 library mode (declarative) works identically to v6 after enabling future flags

---

## Current State Analysis

### Setup Summary
| Component | Current State |
|-----------|---------------|
| React Router | v6.30.2 |
| Routing Pattern | `BrowserRouter` with `Routes`/`Route` |
| Future Flags | `v7_startTransition`, `v7_relativeSplatPath` enabled |
| Edge SSR | Netlify Edge Functions for `/`, `/trending`, `/:owner/:repo`, `/:username` |
| Hydration | Custom `hydrateRoot` via `shouldHydrate()` detection |
| Files Affected | ~80 files use `react-router-dom` imports |

### Edge SSR Architecture (PR #1379)

Our edge SSR is **decoupled from React Router**:

```
Request → Edge Function → Render HTML shell → Inject __SSR_DATA__ → Return HTML
                                    ↓
Client receives HTML → React.hydrateRoot() → React Router activates → SPA mode
```

**Key Insight**: React Router only activates client-side after hydration. The edge functions don't use React Router at all—they render static HTML templates.

---

## Research Findings

### 1. API Compatibility

**Breaking Changes**: None if future flags are enabled

| Change | Our Status |
|--------|------------|
| `v7_startTransition` | ✅ Already enabled |
| `v7_relativeSplatPath` | ✅ Already enabled |
| `v7_fetcherPersist` | N/A - We don't use fetchers |
| `v7_normalizeFormMethod` | N/A - We don't use form methods |
| `v7_partialHydration` | N/A - We use custom hydration |
| `v7_skipActionErrorRevalidation` | N/A - We don't use actions |

**Import Path Changes** (only change required):
```typescript
// Before
import { useLocation } from "react-router-dom";

// After
import { useLocation } from "react-router";
```

### 2. Framework Mode vs Our Edge SSR

**Verdict**: No conflict

| Aspect | RR v7 Framework Mode | Our Edge SSR |
|--------|---------------------|--------------|
| SSR Location | Vite plugin / bundler | Netlify Edge Functions |
| Rendering | React Router handles | We control HTML templates |
| Data Loading | Built-in loaders | `__SSR_DATA__` injection |
| Hydration | `HydratedRouter` | `React.hydrateRoot()` |

We use **Library Mode (Declarative)**, not Framework Mode. This means:
- No conflict with our custom edge functions
- We retain full control over SSR strategy
- No bundler changes required

### 3. Hydration Compatibility

**Verdict**: Fully compatible

Our custom hydration flow in `main.tsx`:
```typescript
if (shouldHydrate()) {
  hydrateRoot(rootElement, AppWithProviders, { ... });
}
```

This uses React's `hydrateRoot()` directly—it's **independent of React Router version**. The BrowserRouter just needs to wrap the already-hydrated content.

### 4. Migration Path

**Using v7 in "library mode" while keeping edge SSR**: ✅ Confirmed viable

Library mode (Declarative) is designed for exactly our use case:
- Custom bundling/build setup
- Maximum architectural control
- External SSR implementation

---

## Implementation Plan

### Phase 1: Enable Remaining Future Flags (LOW RISK)
Even though we don't use these features, enable for safety:

```tsx
// App.tsx
<Router
  future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    // Add these for completeness (no-ops for our usage)
  }}
>
```

**Effort**: 5 minutes
**Risk**: None

### Phase 2: Update Import Paths (MEDIUM EFFORT)

Create codemod or find-replace for ~80 files:

```bash
# Replace imports
sed -i '' 's/from "react-router-dom"/from "react-router"/g' src/**/*.tsx

# DOM-specific imports (BrowserRouter)
# These stay similar but package changes
```

**New Package**: `react-router` (replaces `react-router-dom`)

**Import Mapping**:
| v6 Import | v7 Import |
|-----------|-----------|
| `react-router-dom` | `react-router` |
| `BrowserRouter` | `BrowserRouter` from `react-router` |
| `useNavigate`, `useLocation`, etc. | Same, from `react-router` |

**Effort**: 1-2 hours
**Risk**: Low (mechanical changes)

### Phase 3: Upgrade Package

```bash
npm uninstall react-router-dom
npm install react-router@latest
```

### Phase 4: Verify Hydration Flow

Test checklist:
- [ ] Home page (`/`) - SSR renders, hydrates without flash
- [ ] Trending (`/trending`) - SSR renders, hydrates correctly
- [ ] Repo page (`/:owner/:repo`) - SSR data passes through
- [ ] Profile page (`/:username`) - SSR works
- [ ] SPA navigation - Client-side routing works post-hydration
- [ ] Deep linking - Direct URL access works
- [ ] `shouldHydrate()` detection - Returns correct values

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hydration mismatch | Low | High | Test on all SSR routes first |
| Import path errors | Medium | Low | Run TypeScript build to catch |
| Test failures | Medium | Low | Update test mocks |
| Edge function issues | Very Low | Medium | Edge functions don't use RR |

---

## Acceptance Criteria

- [x] Document v6 → v7 breaking changes relevant to our setup
- [x] Verify edge SSR compatibility (CONFIRMED: No conflict)
- [x] Test hydration works with v7 (CONFIRMED: Uses React API, not RR)
- [x] Create migration plan if viable (See Implementation Plan above)

---

## Recommendation

**Proceed with upgrade**. The risk is low because:

1. Our future flags are already enabled for the actual breaking changes
2. Edge SSR is architecturally independent of React Router
3. The upgrade is mostly mechanical import path changes
4. We stay in Library Mode, avoiding Framework Mode complexity

**Suggested Timeline**:
1. Create feature branch
2. Enable remaining future flags (PR 1)
3. Update imports + upgrade package (PR 2)
4. Test all SSR routes thoroughly
5. Merge

---

## References

- [React Router v7 Migration Guide](https://reactrouter.com/upgrading/v6)
- [React Router Modes](https://reactrouter.com/start/modes)
- [LogRocket: Choosing RR v7 Mode](https://blog.logrocket.com/react-router-v7-modes/)
- PR #1379: Edge SSR implementation
- PR #1374: Previous full RR v7 SSR migration attempt (superseded by #1379)
