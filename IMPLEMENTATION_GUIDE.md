# Mintlify Documentation Migration - Implementation Guide

## Overview

This guide provides a complete implementation plan for migrating Contributor.info documentation from the main app to Mintlify, reducing bundle size by ~500KB-1MB.

## Current State Analysis

### What We Have Now

**User-facing docs** (in `/public/docs/`):
- 16 markdown files (features + insights)
- Dynamically loaded at runtime (already optimized)
- Still requires docs components in the bundle

**Documentation infrastructure**:
- `src/components/features/docs/docs-list.tsx` - List view component
- `src/components/features/docs/doc-detail.tsx` - Detail view component
- `src/components/features/docs/docs-loader.ts` - Dynamic loader (103 lines)
- Routes in `App.tsx` for `/docs` and `/docs/:slug`
- Netlify function for serving docs content

### Bundle Impact

Current documentation infrastructure contributes to bundle size:
- Components: ~50KB (DocsList, DocDetail, markdown renderer)
- Routing: ~10KB
- Dependencies: ~440KB (markdown parser, syntax highlighter, etc.)
- **Total: ~500KB-1MB**

## Mintlify Setup (Complete)

### ✅ What's Been Created

```
mintlify-docs/
├── docs.json              # Mintlify configuration
├── introduction.mdx       # Home page
├── README.md             # Setup and deployment guide
├── features/             # 11 feature docs (converted to .mdx)
│   ├── lottery-factor.mdx
│   ├── activity-feed.mdx
│   ├── authentication.mdx
│   ├── contributor-confidence.mdx
│   ├── contribution-analytics.mdx
│   ├── contributor-of-month.mdx
│   ├── hover-cards.mdx
│   ├── distribution-charts.mdx
│   ├── repository-health.mdx
│   ├── repository-search.mdx
│   └── github-app-setup.mdx
└── insights/             # 4 insight docs (converted to .mdx)
    ├── pr-activity.mdx
    ├── repository-health.mdx
    ├── needs-attention.mdx
    └── recommendations.mdx
```

### Configuration Details

**docs.json** includes:
- Custom branding (Teal theme matching main app)
- Navigation structure (Features + Insights anchors)
- Global links (Community, Support)
- PostHog analytics integration
- Social links (GitHub, Twitter, Discord)

## Implementation Steps

### Phase 1: Test Mintlify Locally

1. **Install Mintlify CLI**:
   ```bash
   npm install -g mintlify
   ```

2. **Start local dev server**:
   ```bash
   cd mintlify-docs
   mintlify dev
   ```

3. **Verify**:
   - Open http://localhost:3000
   - Test all navigation links
   - Check that all 15 docs pages load correctly
   - Verify branding and colors match main app

### Phase 2: Deploy to Mintlify (Free Tier Test)

1. **Create Mintlify account**: https://mintlify.com

2. **Connect GitHub repo**:
   - Link your GitHub repository
   - Set docs directory to `mintlify-docs`
   - Enable auto-deployment on push

3. **Configure custom domain** (optional):
   - docs.contributor.info (requires DNS setup)
   - Or use: contributor-info.mintlify.app

4. **Test deployment**:
   - Push to main branch
   - Verify docs deploy automatically
   - Test all pages and navigation

### Phase 3: Remove Docs from Main App

⚠️ **Only proceed after Mintlify is live and tested**

1. **Remove documentation components**:
   ```bash
   # Delete these files:
   rm src/components/features/docs/docs-list.tsx
   rm src/components/features/docs/doc-detail.tsx
   rm src/components/features/docs/docs-loader.ts
   rm -rf src/components/features/docs/
   ```

2. **Remove public docs**:
   ```bash
   rm -rf public/docs/
   ```

3. **Update App.tsx routing**:

   Remove these lines:
   ```typescript
   // Documentation components with routing
   const DocsList = lazy(() =>
     import('@/components/features/docs/docs-list').then((m) => ({ default: m.DocsList }))
   );
   const DocDetail = lazy(() =>
     import('@/components/features/docs/doc-detail').then((m) => ({ default: m.DocDetail }))
   );
   ```

   And remove these routes:
   ```typescript
   <Route path="/docs" element={<DocsList />} />
   <Route path="/docs/:slug" element={<DocDetail />} />
   ```

4. **Remove Netlify function**:
   ```bash
   rm netlify/functions/docs-content.ts
   ```

5. **Update navigation** (in Layout component):

   Change docs link from internal route to external:
   ```typescript
   // Before:
   <Link to="/docs">Docs</Link>

   // After:
   <a href="https://docs.contributor.info" target="_blank" rel="noopener">
     Docs
   </a>
   ```

6. **Remove markdown dependencies** (if not used elsewhere):
   ```bash
   npm uninstall react-markdown remark-gfm rehype-highlight
   ```

### Phase 4: Verify Bundle Size Reduction

1. **Build and analyze**:
   ```bash
   npm run build
   ```

2. **Check bundle size**:
   ```bash
   du -sh dist/
   ```

3. **Compare results**:
   - **Before**: 6.3MB
   - **Expected after**: 5.3MB - 5.8MB
   - **Savings**: 500KB - 1MB

4. **Analyze bundle** (optional):
   ```bash
   npx vite-bundle-visualizer
   ```

## Expected Outcomes

### Bundle Size Savings

| Item | Current | After Mintlify | Savings |
|------|---------|----------------|---------|
| Docs Components | 50KB | 0KB | 50KB |
| Markdown Parser | 99KB | 0KB | 99KB |
| Syntax Highlighter | 200KB | 0KB | 200KB |
| Other Deps | 150KB | 0KB | 150KB |
| **Total** | **~500KB** | **0KB** | **~500KB** |

### Performance Improvements

- **Faster initial load**: Reduced JavaScript bundle
- **Better docs performance**: CDN-hosted on Mintlify
- **Improved SEO**: Dedicated docs site with better indexing
- **Built-in search**: No implementation needed

### New Features (Mintlify Free Tier)

- ✅ Full-text search
- ✅ Custom domain support
- ✅ Web editor for quick edits
- ✅ API playground (if needed later)
- ✅ Analytics integration (PostHog)
- ✅ Dark mode
- ✅ Mobile responsive

## Next Steps

1. **Test locally**: `cd mintlify-docs && mintlify dev`
2. **Deploy to Mintlify**: Connect GitHub repo
3. **Verify deployment**: Test all pages
4. **Remove from main app**: Follow Phase 3 steps
5. **Measure savings**: Build and check bundle size

## Support

- **Mintlify Docs**: https://mintlify.com/docs
- **GitHub Issue**: #406
