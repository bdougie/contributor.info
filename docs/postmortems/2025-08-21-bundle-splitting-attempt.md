# Bundle Splitting Attempt Postmortem: The React Initialization Saga

**Date:** 2025-08-21  
**Duration:** ~4 hours  
**Severity:** High (Multiple production deployment failures)  
**Status:** Resolved with compromises

## Executive Summary

Attempted to optimize bundle sizes for issue #463 by aggressively splitting code into smaller chunks. This resulted in cascading initialization errors that revealed fundamental constraints about React module loading. Final solution prioritizes stability over micro-optimization.

## The Journey: From 1.1MB to Multiple Failures to 859KB

### Initial State
- **Main bundle**: 1,158KB (blocking initial load)
- **Lighthouse score**: 65/100
- **LCP**: 5.9s

### Attempt 1: Aggressive Splitting (Failed)
**Strategy**: Split everything - Radix UI, Nivo, Recharts, D3, app code  
**Result**: Main bundle reduced to 204KB  
**Failure**: `Cannot read properties of undefined (reading 'forwardRef')`  
**Learning**: Radix UI components use React.forwardRef and must be bundled with React

### Attempt 2: Combine Radix with React (Failed)
**Strategy**: Bundle Radix UI with React, keep charts separate  
**Result**: vendor-react at 653KB  
**Failure**: `Cannot read properties of undefined (reading 'memo')`  
**Learning**: Nivo charts use React.memo and also need React

### Attempt 3: Add Nivo to React (Failed)
**Strategy**: Bundle React + Radix + Nivo, separate Recharts  
**Result**: vendor-react at 743KB  
**Failure**: `Cannot access 'C' before initialization` in vendor-charts  
**Learning**: Recharts/D3 have hidden React dependencies

### Attempt 4: All Charts with React (Failed)
**Strategy**: Bundle all visualization libraries with React  
**Result**: vendor-react at 1,231KB  
**Failure**: `Cannot read properties of undefined (reading 'createContext')` in app-charts  
**Learning**: App components using React Context can't be split

### Attempt 5: Remove App Splitting (Failed)
**Strategy**: Only split admin code, keep other app code together  
**Result**: Main bundle at 275KB  
**Failure**: `Cannot access 're' before initialization` in app-admin  
**Learning**: Even lazy-loaded admin code has React dependencies

### Final Solution: Conservative Approach (Success)
**Strategy**: Bundle ALL React-dependent code together, no app splitting  
**Result**: 
- vendor-react: 1,231KB (all React ecosystem)
- Main bundle: 859KB (all app code)
- vendor-supabase: 113KB (truly standalone)
- vendor-utils: 21KB (pure utilities)

## Root Cause Analysis

### Why Function-Based Chunking Failed

Our function-based approach created unpredictable module initialization order:

```typescript
// ❌ What we tried - too complex
manualChunks: (id) => {
  if (id.includes('@radix-ui')) return 'vendor-ui';
  if (id.includes('recharts')) return 'vendor-charts';
  // etc...
}
```

This differs from successful approaches in our docs that used simple object mapping:

```typescript
// ✅ What worked before
manualChunks: {
  'vendor-react': ['react', 'react-dom', '@radix-ui/*'],
  'vendor-charts': ['recharts', 'd3']
}
```

### The React Initialization Constraint

React and any library using React APIs must initialize together:
- `React.forwardRef` (Radix UI)
- `React.memo` (Nivo)  
- `React.createContext` (App components)
- Hidden dependencies (Recharts, D3)

### Netlify Processing Conflict

Netlify's JS bundling/minification was re-ordering our chunks:
- Had to disable with `bundle = false, minify = false`
- This was documented in June 2025 but we initially missed it

## Impact Analysis

### What We Gained
- **26% reduction** in main bundle (1,158KB → 859KB)
- **Stable deployment** with no initialization errors
- **Clear documentation** of what doesn't work
- **Vendor separation** for truly standalone code

### What We Lost
- **Optimal chunking**: vendor-react is larger than ideal (1.2MB)
- **App code splitting**: All components load upfront
- **Performance target**: Still at Lighthouse 65-70 (target 80+)

## Lessons Learned

### 1. React Ecosystem is Monolithic
**Finding**: Any code that touches React APIs must be in the same chunk  
**Implication**: Library-level splitting has limited value for React apps

### 2. Real Performance Gains Are Elsewhere
Bundle splitting gave us 26% reduction but Lighthouse barely moved. The real issues are:
- No route-based code splitting
- No lazy loading of heavy components
- Missing resource hints and preloading
- No service worker caching

### 3. Stability > Micro-optimization
A working 859KB bundle is infinitely better than a broken 204KB bundle.

### 4. Documentation Was Right
Our existing docs warned about these exact issues:
- "React and all React-dependent libraries MUST stay bundled together"
- "Function-based manual chunks created unpredictable loading order"
- We learned these lessons the hard way

## Action Items

### Completed
- [x] Disabled Netlify JS processing
- [x] Combined all React dependencies into single chunk
- [x] Removed problematic app code splitting
- [x] Achieved stable deployment

### Future Work (from #462)
- [ ] Implement route-based code splitting (#464)
- [ ] Add resource loading optimization (#465)  
- [ ] Deploy service worker caching (#466)
- [ ] Consider SSR/SSG for initial render

## Best Practices Going Forward

### DO:
- ✅ Keep React ecosystem together
- ✅ Use simple object-based chunk configuration
- ✅ Focus on route/feature splitting over library splitting
- ✅ Test on Netlify preview before production

### DON'T:
- ❌ Split libraries that use React APIs
- ❌ Use complex function-based chunking
- ❌ Trust that local dev = production behavior
- ❌ Enable Netlify's JS processing with Vite

## Conclusion

This attempt taught us that **the architecture of React itself constrains how we can split code**. The monolithic nature of the React ecosystem means traditional bundle splitting strategies have limited effectiveness. 

The path to better performance lies not in splitting vendor libraries but in:
1. Route-based code splitting
2. Progressive enhancement
3. Caching strategies
4. Resource optimization

Our "failed" optimization actually succeeded in teaching us where to focus our efforts. The 26% bundle reduction is a nice win, but the real performance gains will come from the strategies outlined in issue #462.

## References
- [Issue #463: Critical Bundle Splitting](https://github.com/bdougie/contributor.info/issues/463)
- [PR #468: Bundle Splitting Implementation](https://github.com/bdougie/contributor.info/pull/468)
- [Previous Postmortem: Production Deployment 2025-06-22](./production-deployment-2025-06-22.md)
- [Bundle Optimization Guide](../performance/BUNDLE_OPTIMIZATION_2025.md)