# Content Security Policy (CSP) Configuration

## Overview

Content Security Policy (CSP) is a security feature that helps prevent cross-site scripting (XSS), clickjacking, and other code injection attacks. This document outlines our CSP configuration and common troubleshooting steps.

## Current CSP Configuration

Our CSP is configured in `/public/_headers` and defines allowed sources for various resource types:

### Key Directives

#### `default-src`
- **Value**: `'self'`
- **Purpose**: Sets the default policy for all resource types not explicitly defined

#### `script-src`
- **Allowed Sources**:
  - `'self'` - Scripts from our own domain
  - `'unsafe-inline'` - Required for React and inline scripts
  - `'unsafe-eval'` - Required for some build tools and libraries
  - `https://*.posthog.com` - Analytics tracking
  - `https://us.i.posthog.com` - PostHog US region
  - `https://vercel.live` - Vercel preview comments

#### `connect-src`
- **Allowed Sources**:
  - `'self'` - API calls to our own domain
  - `https://contributor.info` - Production domain
  - `https://*.contributor.info` - Subdomains and preview deployments
  - `https://*.netlify.app` - Netlify preview deployments
  - `https://avatars.githubusercontent.com` - GitHub user avatars
  - `https://*.supabase.co` - Supabase database API
  - `https://*.supabase.in` - Supabase India region
  - `https://*.posthog.com` - Analytics API
  - `https://us.i.posthog.com` - PostHog US API
  - `https://api.github.com` - GitHub API
  - `https://raw.githubusercontent.com` - Raw GitHub content
  - `https://contributor-info-webhooks.fly.dev` - Webhook service
  - `https://contributor-info-social-cards.fly.dev` - Social card service
  - `https://vercel.live` - Vercel preview features
  - `https://ingesteer.services-prod.nsvcs.net` - RUM/monitoring service
  - `wss://*.supabase.co` - Supabase WebSocket connections
  - `wss://*.supabase.in` - Supabase India WebSocket

#### `img-src`
- **Allowed Sources**:
  - `'self'` - Images from our domain
  - `data:` - Base64 encoded images
  - `blob:` - Blob URLs for dynamic images
  - `https:` - All HTTPS images (needed for GitHub avatars)
  - `http:` - HTTP images (fallback)

#### `style-src`
- **Allowed Sources**:
  - `'self'` - Our own stylesheets
  - `'unsafe-inline'` - Required for styled-components and inline styles
  - `https://fonts.googleapis.com` - Google Fonts
  - `https://fonts.gstatic.com` - Google Fonts static assets

#### `font-src`
- **Allowed Sources**:
  - `'self'` - Self-hosted fonts
  - `https://fonts.gstatic.com` - Google Fonts
  - `data:` - Inline font data

#### `frame-src`
- **Allowed Sources**:
  - `'self'` - Our own iframes
  - `https://vercel.live` - Vercel preview comments
  - `https://app.netlify.com` - Netlify admin features

#### `worker-src`
- **Allowed Sources**:
  - `'self'` - Service workers from our domain
  - `blob:` - Web workers from blob URLs

## Build Process

### Headers File Management

The CSP headers are managed through a two-step process:

1. **Development**: Edit `/public/_headers`
2. **Build**: The build script copies headers to `/dist/_headers`
   ```bash
   npm run build
   # This runs: cp public/_headers dist/_headers
   ```

### Important Notes

- Always edit `/public/_headers`, never `/dist/_headers` directly
- The build process automatically copies headers to the dist folder
- Netlify reads headers from the publish directory (`dist`)

## Troubleshooting CSP Issues

### Common CSP Violations and Solutions

#### 1. "Refused to connect to [URL]"

**Error Example**:
```
Refused to connect to 'https://example.com/api' because it violates the following Content Security Policy directive: "connect-src..."
```

**Solution**:
Add the domain to `connect-src` in `/public/_headers`:
```
connect-src 'self' https://example.com ...
```

#### 2. "Refused to load the script"

**Error Example**:
```
Refused to load the script 'https://cdn.example.com/script.js' because it violates the following Content Security Policy directive: "script-src..."
```

**Solution**:
Add the domain to `script-src`:
```
script-src 'self' https://cdn.example.com ...
```

#### 3. "Refused to load the stylesheet"

**Error Example**:
```
Refused to load the stylesheet 'https://fonts.googleapis.com/css2' because it violates the following Content Security Policy directive: "style-src..."
```

**Solution**:
Add the domain to `style-src`:
```
style-src 'self' https://fonts.googleapis.com ...
```

#### 4. Service Worker Fetch Violations

**Error Example**:
```
[Service Worker] Fetch API cannot load https://contributor.info/... Refused to connect
```

**Solution**:
Service workers need explicit permissions in `connect-src` for all domains they fetch from:
```
connect-src 'self' https://contributor.info https://avatars.githubusercontent.com ...
```

### Debugging CSP Issues

#### 1. Check Browser Console

CSP violations appear in the browser console with detailed error messages indicating:
- Which directive was violated
- What resource was blocked
- The current CSP configuration

#### 2. Verify Deployed Headers

Check if your CSP changes are deployed:

```bash
# Check production headers
curl -I https://contributor.info | grep -i content-security

# Check preview deployment
curl -I https://deploy-preview-XXX--contributor-info.netlify.app | grep -i content-security
```

#### 3. Test Locally

While Vite dev server doesn't enforce CSP headers, you can test the build locally:

```bash
npm run build
npm run preview
# Check network tab for CSP headers
```

#### 4. Common Gotchas

##### Headers Not Updating
**Problem**: Changed `/public/_headers` but CSP not updating in production

**Solution**: 
1. Ensure build process includes: `cp public/_headers dist/_headers`
2. Clear service worker cache if needed
3. Check Netlify deploy logs for build errors

##### Service Worker Caching Old CSP
**Problem**: Service worker continues using old CSP even after deployment

**Solution**:
1. Update service worker version in `/public/sw.js`
2. Clear browser cache and service workers
3. Force refresh (Cmd+Shift+R or Ctrl+Shift+R)

##### Missing Wildcards
**Problem**: Need to allow multiple subdomains

**Solution**: Use wildcards appropriately:
```
# Correct
https://*.supabase.co

# Incorrect (too restrictive)
https://abc123.supabase.co
```

### Testing CSP Changes

1. **Make Changes**: Edit `/public/_headers`
2. **Copy to Dist**: Run `cp public/_headers dist/_headers`
3. **Test Build**: Run `npm run build && npm run preview`
4. **Check Headers**: Open DevTools → Network → Check response headers
5. **Test Functionality**: Verify all features work without CSP violations
6. **Commit Changes**: Commit both `/public/_headers` and build changes

## Permissions Policy

In addition to CSP, we also configure Permissions Policy to control browser features:

```
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), fullscreen=(self), picture-in-picture=()
```

- Most features are disabled `()`
- `fullscreen=(self)` allows fullscreen on our domain
- `picture-in-picture=()` is disabled

## Security Considerations

### Why We Use 'unsafe-inline' and 'unsafe-eval'

While these directives reduce CSP security, they're necessary for:
- **'unsafe-inline'**: React's style prop, styled-components, CSS-in-JS
- **'unsafe-eval'**: Some bundlers and development tools

### Mitigation Strategies

1. **Minimize inline scripts**: Use external scripts where possible
2. **Use nonces**: For critical inline scripts (future improvement)
3. **Regular audits**: Review CSP for unnecessary permissions
4. **Monitor violations**: Set up CSP reporting (future improvement)

## Future Improvements

1. **CSP Reporting**: Implement CSP violation reporting endpoint
2. **Nonce-based CSP**: Move away from 'unsafe-inline' using nonces
3. **Stricter Policies**: Gradually tighten CSP as codebase allows
4. **Environment-specific CSP**: Different policies for dev/staging/production

## References

- [MDN CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator by Google](https://csp-evaluator.withgoogle.com/)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [Netlify Headers Documentation](https://docs.netlify.com/routing/headers/)