# Netlify Performance Baseline Audit - December 9, 2025

## Executive Summary

**Audit Date:** 2025-12-09  
**Current Status:** No open PRs to audit  
**Recent Activity:** Multiple performance PRs merged (PRs #1274, #1275, #1281, #1282)  
**Agent Status:** Ready for deployment audits

## Current Build Configuration

### Vite Configuration Analysis

#### ✅ Strengths

1. **Modern Build Tools**
   - Using `@vitejs/plugin-react-swc` for faster compilation
   - ESBuild for minification (faster than Terser)
   - Modern target: ES2020

2. **Excellent Code Splitting Strategy**
   - Manual chunks configured for all major vendors:
     - `vendor-react-core` - React, React DOM, React Router
     - `vendor-ui` - Radix UI components
     - `vendor-nivo`, `vendor-recharts`, `vendor-d3`, `vendor-uplot` - Chart libraries
     - `vendor-supabase` - Database client
     - `vendor-markdown` - Markdown rendering (lazy loaded)
     - `vendor-analytics` - PostHog (lazy loaded)
     - `vendor-monitoring` - Sentry
   - CSS code splitting enabled

3. **Production Optimizations**
   - Source maps disabled in production (saves ~15MB)
   - Console/debugger stripped in production
   - Legal comments removed
   - Tree shaking enabled with `moduleSideEffects: false`

4. **Module Preload Strategy**
   - Smart prioritization:
     1. React core
     2. UI components (Radix)
     3. Utilities (clsx, tailwind-merge)
     4. Main app chunk
   - Heavy libraries (markdown, charts, analytics) excluded from preload

5. **Image Optimization**
   - `vite-imagetools` configured for WebP/AVIF conversion
   - Auto-optimization with quality presets

6. **Development Performance**
   - Warmup configured for frequently used files
   - Proxy setup for Netlify functions
   - Optimized dependency pre-bundling with explicit includes/excludes

#### ⚠️ Areas for Potential Improvement

1. **Netlify Build Configuration** (`netlify.toml`)
   ```toml
   [build.processing.js]
     bundle = false
     minify = false
   ```
   - **Issue:** JS minification is disabled at Netlify level
   - **Impact:** Vite handles minification, but Netlify's post-processing could add extra compression
   - **Recommendation:** Monitor bundle size; current approach avoids double-minification overhead

2. **Heavy Dependencies in Production Bundle**
   - `@xenova/transformers` (2.17.2) - ML library for embeddings
   - `onnxruntime-web` - Excluded from optimizeDeps
   - **Current Status:** Excluded from pre-bundling, but may still be in production
   - **Recommendation:** Verify these are truly excluded or move to serverless functions

3. **Chunk Size Warning Limit**
   - Set to 1300KB to accommodate `vendor-react-core`
   - **Recommendation:** Monitor if this chunk grows larger

## Dependency Analysis

### Major Bundle Contributors

**UI Framework & Libraries:**
- React + React DOM + React Router → `vendor-react-core` chunk
- 30+ Radix UI packages → `vendor-ui` chunk
- Potential for tree-shaking improvements if not all components are used

**Chart Libraries (Lazy-Loadable):**
- `@nivo/heatmap`, `@nivo/scatterplot`
- `recharts`
- `uplot`
- `d3-*` dependencies
- **Status:** Properly chunked for lazy loading ✅

**Third-Party Services:**
- `@supabase/supabase-js` (2.39.8)
- `posthog-js` (1.285.0)
- `@sentry/react` (10.27.0)
- `inngest` (3.44.5)
- `dub` (0.66.4)

**Markdown Rendering:**
- `react-markdown` + rehype/remark plugins
- **Status:** Chunked separately for lazy loading ✅

### Potential Optimization Opportunities

1. **Radix UI Components**
   - Currently 30+ packages imported
   - Audit which components are actually used
   - Potential savings: 50-100KB by removing unused components

2. **Multiple Chart Libraries**
   - Using Nivo, Recharts, and uPlot
   - **Question:** Are all three necessary?
   - **Recommendation:** Standardize on one library if possible

3. **Date Formatting**
   - Using `date-fns` (full library)
   - **Recommendation:** Consider importing only needed functions

## Recent Performance Work

### Merged Performance PRs

1. **PR #1282** - Supabase lazy loading (merged Dec 9, 23:30 UTC)
   - Deferred Supabase client initialization
   - Goal: Improve LCP

2. **PR #1281** - PostHog deferral (merged Dec 9, 19:31 UTC)
   - Extended PostHog deferral for better LCP

3. **PR #1275** - State update debouncing (merged Dec 8, 22:26 UTC)
   - Debounced `useWorkspaceIssues` hook

4. **PR #1274** - Cached issues strategy (merged Dec 8, 20:58 UTC)
   - Show cached data immediately, sync in background

## Performance Audit Agent Readiness

### Agent Capabilities

✅ **Ready to Audit:**
- Bundle size comparisons (JS, CSS, images)
- Build configuration issues
- Dependency analysis
- Cache header validation
- Critical performance regressions

✅ **Blocking Criteria Configured:**
- >50% bundle increase → Block
- Minification disabled → Block
- Tree-shaking disabled → Block
- Production sourcemaps → Block
- Missing cache headers → Block

✅ **Tiered Analysis:**
- <10% change → Quick approval (minimal tokens)
- 10-50% → Standard analysis
- >50% → Full deep-dive analysis

### Integration Points

**Netlify MCP Tools Available:**
- `get-deploy` - Fetch deploy details
- `get-deploy-for-site` - Fetch site-specific deploy
- `get-projects` - List projects
- `deploy-site` - Deploy to Netlify

**Workflow:**
1. Get production deploy URL
2. Get preview deploy URL
3. Fetch and parse bundle stats
4. Compare sizes across asset types
5. Analyze configuration if issues found
6. Generate report with recommendations

## Recommendations for Next Audit

### When New PR Opens:

1. **Baseline Capture**
   - Document current production bundle sizes
   - Store as baseline for comparison

2. **Key Metrics to Track**
   - Total bundle size (JS + CSS + images)
   - Individual vendor chunk sizes
   - LCP impact (if Lighthouse data available)
   - Cache hit rates

3. **Red Flags to Watch For**
   - New large dependencies added
   - Vendor chunks growing >20%
   - Main bundle growing >10%
   - New synchronous imports of heavy libraries

4. **Green Flags to Celebrate**
   - Lazy loading additions
   - Dependency removals/replacements
   - Code splitting improvements
   - Image optimizations

## Current State: Green ✅

The codebase demonstrates excellent performance engineering:
- Modern build tooling
- Strategic code splitting
- Lazy loading of heavy dependencies
- Recent performance optimizations merged
- Agent ready for continuous monitoring

**Next Action:** Wait for next PR to perform comparative audit using Netlify Performance Auditor Agent.

---

**Audit Tool:** Netlify Performance Auditor Agent (Continue CLI)  
**Documentation:** `docs/continue-agent-workflows.md`  
**Related PRs:** #1274, #1275, #1281, #1282, #1284
