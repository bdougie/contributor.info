# Bundle Splitting Lessons: What Works and What Doesn't

**Created:** 2025-08-21  
**Purpose:** Document hard-won lessons about bundle splitting in React applications

## The Core Lesson

**React's architecture fundamentally constrains how you can split bundles.** Any code that uses React APIs must be initialized together with React itself.

## What DOESN'T Work ❌

### 1. Splitting React UI Libraries
```typescript
// ❌ FAILS: Radix UI uses React.forwardRef
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-ui': ['@radix-ui/*']  // Error: Cannot read 'forwardRef'
}
```

### 2. Splitting Visualization Libraries
```typescript
// ❌ FAILS: Chart libraries have React dependencies
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-charts': ['recharts', 'nivo']  // Error: Cannot read 'memo'
}
```

### 3. Splitting App Components
```typescript
// ❌ FAILS: Components use React Context
manualChunks: (id) => {
  if (id.includes('/charts/')) return 'app-charts';  // Error: Cannot read 'createContext'
}
```

### 4. Complex Function-Based Chunking
```typescript
// ❌ UNPREDICTABLE: Creates initialization order issues
manualChunks: (id) => {
  // Complex logic creates unpredictable module order
  if (id.includes('something')) return 'chunk-a';
  if (id.includes('other')) return 'chunk-b';
  // etc...
}
```

### 5. Netlify JS Processing with Vite
```toml
# ❌ BREAKS: Netlify reorders Vite's carefully crafted chunks
[build.processing.js]
  bundle = true
  minify = true
```

## What DOES Work ✅

### 1. Monolithic React Bundle
```typescript
// ✅ STABLE: All React ecosystem together
manualChunks: {
  'vendor-react': [
    'react',
    'react-dom',
    'react-router-dom',
    '@radix-ui/*',
    '@nivo/*',
    'recharts',
    'd3-*'
  ]
}
```

### 2. Splitting Truly Independent Libraries
```typescript
// ✅ WORKS: These don't depend on React
manualChunks: {
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-utils': ['clsx', 'tailwind-merge', 'date-fns'],
  'vendor-markdown': ['remark', 'rehype']
}
```

### 3. Simple Object-Based Configuration
```typescript
// ✅ PREDICTABLE: Simple object mapping
manualChunks: {
  'chunk-name': ['package-1', 'package-2']
}
// NOT function-based logic
```

### 4. Route-Based Code Splitting
```typescript
// ✅ EFFECTIVE: Split at route level, not library level
const RepoView = lazy(() => import('./pages/repo-view'));
const OrgView = lazy(() => import('./pages/org-view'));
```

### 5. Disabled Netlify Processing
```toml
# ✅ REQUIRED: Let Vite handle bundling
[build.processing.js]
  bundle = false
  minify = false
```

## The React Dependency Matrix

| Library Type | Can Split? | Reason |
|-------------|-----------|---------|
| React Core | ❌ No | Foundation |
| Radix UI | ❌ No | Uses forwardRef |
| Nivo | ❌ No | Uses memo |
| Recharts | ❌ No | Hidden React deps |
| D3 | ❌ No | Used by Recharts |
| Supabase | ✅ Yes | No React deps |
| Utilities | ✅ Yes | Pure functions |
| Markdown | ✅ Yes | No React deps |

## Performance Impact Reality Check

### What We Expected
- Split bundles = Better performance
- Smaller chunks = Faster loading
- More splitting = Higher Lighthouse score

### What Actually Happened
- Bundle reduced 26% (1,158KB → 859KB)
- Lighthouse score barely moved (65 → 70)
- Real bottlenecks were elsewhere

### The Real Performance Wins
1. **Route-based splitting** > Library splitting
2. **Lazy loading components** > Splitting vendors
3. **Service worker caching** > Smaller initial bundle
4. **Resource hints** > Bundle optimization
5. **SSR/SSG** > Client-side optimization

## Decision Framework

### When to Split a Bundle

**Split when ALL conditions are met:**
- ✅ No React API usage (forwardRef, memo, hooks, context)
- ✅ No hidden React dependencies
- ✅ Truly standalone functionality
- ✅ Significant size (>50KB)

**Don't split when ANY are true:**
- ❌ Uses React APIs
- ❌ Part of React component tree
- ❌ Complex initialization dependencies
- ❌ Small size (<50KB)

### Recommended Chunking Strategy

```typescript
// Conservative, stable approach
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // One big React chunk (accept it)
          'vendor-react': ['react', 'react-dom', 'all-react-libs'],
          
          // Truly independent vendors
          'vendor-db': ['@supabase/supabase-js'],
          'vendor-utils': ['pure-utility-libs'],
          
          // Don't split app code
          // Use lazy loading at route level instead
        }
      }
    }
  }
}
```

## Testing Checklist

Before deploying bundle changes:

- [ ] Test in production build locally
- [ ] Check all React-dependent features work
- [ ] Verify no console errors about undefined properties
- [ ] Test on Netlify preview deployment
- [ ] Check module loading order in Network tab
- [ ] Measure actual Lighthouse improvement
- [ ] Ensure no functionality regression

## Alternative Approaches

If bundle size is critical:

1. **Server-Side Rendering (SSR)**
   - Render React on server
   - Send HTML, hydrate client-side
   - Bypasses initialization issues

2. **Static Site Generation (SSG)**
   - Pre-render at build time
   - Minimal client-side JavaScript
   - Best for content-heavy sites

3. **Progressive Enhancement**
   - HTML-first approach
   - Add React for interactivity
   - Not everything needs React

4. **Different Framework**
   - Svelte/Solid: Compile away framework
   - Preact: Smaller React alternative
   - Vanilla JS: For simple interactions

## Conclusion

The fundamental lesson: **React's architecture creates a natural ~1.2MB floor for bundle size** when including a full UI ecosystem. Attempts to break this apart lead to initialization failures.

Accept this constraint and focus optimization efforts on:
- Route-based code splitting
- Lazy loading features
- Caching strategies
- Resource optimization
- Alternative rendering strategies

The path to performance isn't through splitting React into pieces, but through architecting your application to need less of it upfront.

## References

- [Bundle Splitting Attempt Postmortem](../postmortem/bundle-splitting-attempt-2025-08-21.md)
- [Production Deployment Postmortem](../postmortem/production-deployment-2025-06-22.md)
- [Issue #462: Performance Optimization](https://github.com/bdougie/contributor.info/issues/462)
- [PR #468: Bundle Splitting Implementation](https://github.com/bdougie/contributor.info/pull/468)