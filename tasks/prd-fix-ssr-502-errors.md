# PRD: Fix SSR 502 Edge Function Errors

## Problem Statement

PR #1374 migrates contributor.info to React Router v7 with SSR on Netlify. The deploy preview returns **502 errors**.

**Deploy Preview**: https://deploy-preview-1374--contributor-info.netlify.app/
**Error**: "This edge function has crashed"

## Root Cause Analysis

### PRIMARY CAUSE: Edge SSR Not Supported

According to [Netlify's official React Router 7 deployment guide](https://developers.netlify.com/guides/how-to-deploy-a-react-router-7-site-to-netlify/):

> "Edge SSR not yet supported" with React Router 7 on Netlify currently.
> "If you had opted in to edge rendering with Remix 2... note that this is not yet supported with React Router 7. The above steps will configure rendering at the origin instead."

**The current implementation uses `edge: true` which is NOT SUPPORTED:**

```typescript
// vite.config.ts - CURRENT (BROKEN)
netlifyReactRouter({
  edge: true,  // ❌ NOT SUPPORTED FOR REACT ROUTER 7
  excludedPaths: ['/api/*', '/.netlify/functions/*'],
}),
netlify(),  // ❌ Extra plugin not in official docs
```

### SECONDARY CAUSE: Browser API Access During SSR

Even with origin-based SSR, some code accesses browser APIs without guards. This is a secondary concern to address after fixing the primary config issue.

## Fix Implementation

### Phase 1: Fix Vite Config (PRIMARY FIX)

Update `vite.config.ts` to match Netlify's official pattern:

```typescript
// vite.config.ts - FIXED
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import netlifyPlugin from '@netlify/vite-plugin-react-router';
// ... other imports

export default defineConfig(() => ({
  plugins: [
    reactRouter(),
    netlifyPlugin(),  // No edge option - uses origin SSR
    // ... other plugins
  ],
  // ... rest of config
}));
```

**Changes required:**
1. Remove `edge: true` option
2. Remove `excludedPaths` option (handle via netlify.toml redirects)
3. Remove extra `netlify()` plugin import

### Phase 2: Update netlify.toml

Change build command to use react-router directly:

```toml
[build]
  publish = "build/client"
  command = "react-router build"  # Changed from "npm run build"
```

### Phase 3: Add SSR Guards (Secondary)

After fixing the config, if SSR still has issues, add guards to these files:

| File | Issue |
|------|-------|
| `src/lib/plg-tracking-utils.ts` | localStorage/sessionStorage without guards |
| `src/hooks/use-analytics.ts` | window.location in callbacks |
| `src/lib/feature-flags/context.tsx` | requestIdleCallback without guard |

## Testing Checklist

- [ ] `npm run build` succeeds
- [ ] Deploy preview loads without 502 errors
- [ ] Homepage renders correctly
- [ ] Repository pages load and display data
- [ ] Login/auth flow works
- [ ] Analytics events fire on client

## Success Metrics

- Deploy preview returns 200 status
- No edge function errors in Netlify logs
- LCP improvement maintained (target < 2.5s)

## References

- [Netlify React Router 7 Guide](https://developers.netlify.com/guides/how-to-deploy-a-react-router-7-site-to-netlify/)
- [React Router v7 Docs](https://reactrouter.com/)
