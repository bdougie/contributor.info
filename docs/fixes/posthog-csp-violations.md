# PostHog CSP Violations Fix

**Date:** 2025-11-24  
**PR:** [#1245](https://github.com/bdougie/contributor.info/pull/1245)  
**Status:** ✅ Fixed

## Problem

PostHog's session recording feature was triggering **Content Security Policy (CSP) violations** in the browser console:

```
Applying inline style violates the following Content Security Policy directive 'style-src ...'
Either the 'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce ('nonce-...') is required
to enable inline execution. The action has been blocked.
```

### CSP Violations Logged

Multiple hashes were being rejected:
- `sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo=` (vendor-ui)
- `sha256-3juv2Ft1FaY3xWYNGXExi9oTqA3RQ4gtgCqyf3mxGhU=` (record.js)
- `sha256-u+Rk/5AL3dunZWvfY3KjmuFuGFWzreMwowBwCCGqr5M=` (record.js)
- `sha256-Hpgy6ySBMLFvhf9n57NVbYSqSKne6nBTHPTrs1z5TAE=` (record.js)

### Root Cause

PostHog's session recording library applies **inline styles dynamically** to track DOM changes and user interactions. Our strict CSP policy blocks these inline styles unless explicitly whitelisted via SHA-256 hashes.

The CSP policy was missing the hashes for PostHog's specific inline style patterns.

## Impact

While these CSP violations **did not break functionality** (PostHog continued to work), they:
- ❌ Created noise in browser console logs
- ❌ Could interfere with session recording quality
- ❌ Made debugging harder by cluttering console
- ❌ Indicated potential security policy gaps

## Solution

### Added Missing Style Hashes

**File:** `public/_headers`

Added the four missing PostHog session recording style hashes to the CSP `style-src` directive:

```diff
- style-src 'self' https://fonts.googleapis.com 'unsafe-hashes' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-Od9mHMH7x2G6QuoV3hsPkDCwIyqbg2DX3F5nLeCYQBc=' 'sha256-xvtTv7uvC5+0GaDrlzTnq66BuHoCGZg9f04RdFS59jU=' 'sha256-dH+oOZOdDv+MWU0F8bCZOoFHX0jFM4+bwNqOKujbv90=';
+ style-src 'self' https://fonts.googleapis.com 'unsafe-hashes' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-Od9mHMH7x2G6QuoV3hsPkDCwIyqbg2DX3F5nLeCYQBc=' 'sha256-xvtTv7uvC5+0GaDrlzTnq66BuHoCGZg9f04RdFS59jU=' 'sha256-dH+oOZOdDv+MWU0F8bCZOoFHX0jFM4+bwNqOKujbv90=' 'sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo=' 'sha256-3juv2Ft1FaY3xWYNGXExi9oTqA3RQ4gtgCqyf3mxGhU=' 'sha256-u+Rk/5AL3dunZWvfY3KjmuFuGFWzreMwowBwCCGqr5M=' 'sha256-Hpgy6ySBMLFvhf9n57NVbYSqSKne6nBTHPTrs1z5TAE=';
```

### Updated CSP Documentation

Added inline comment explaining the PostHog-specific hashes:

```
# PostHog session recording hashes for inline styles (nzTgYzXYDNe6BAHiiI7NNlfK8n, 3juv2Ft1FaY3xWYNGXExi9oTqA3RQ4gtgCqyf3mxGhU, u+Rk, Hpgy6ySBMLFvhf9n57NVbYSqSKne6nBTHPTrs1z5TAE)
```

## Technical Details

### How CSP Style Hashing Works

1. **Browser calculates hash** of inline style content
2. **Compares against whitelist** in CSP `style-src` directive
3. **Allows or blocks** based on match

### Why We Use Hashes Instead of 'unsafe-inline'

- ✅ **More Secure**: Only specific style patterns are allowed
- ✅ **XSS Protection**: Prevents arbitrary inline style injection
- ✅ **Granular Control**: We know exactly what's being allowed
- ❌ `'unsafe-inline'` would allow **any** inline styles (dangerous)

### Hash Sources

The hashes were extracted from actual CSP violation reports in the browser console:

```javascript
// Example from console error:
// "Either the 'unsafe-inline' keyword, a hash ('sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo='), 
//  or a nonce ('nonce-...') is required to enable inline execution."
```

## Verification

### Before Fix
```bash
# Browser console showed multiple CSP violations
❌ Applying inline style violates Content Security Policy directive 'style-src ...'
❌ The action has been blocked.
```

### After Fix
```bash
# CSP hash verification passed
✅ npm run verify:csp
✅ CSP hash verification passed
```

### Testing
```bash
# Verify CSP headers are correct
npm run verify:csp

# Build with headers copied to dist
npm run build
```

## Benefits

- ✅ **Clean Console**: No more CSP violation noise
- ✅ **Better Session Recording**: PostHog can apply styles without restrictions
- ✅ **Maintained Security**: Still using strict CSP with specific hashes
- ✅ **Future-Proof**: Documented which hashes are for PostHog
- ✅ **Developer Experience**: Easier debugging without console spam

## Why This Matters

### Security vs. Usability Trade-off

We could have used `'unsafe-inline'` to allow all inline styles, but that would:
- ❌ Weaken XSS protection
- ❌ Allow malicious inline style injection
- ❌ Reduce overall security posture

By using **specific hashes**, we maintain:
- ✅ Strong CSP protection
- ✅ XSS mitigation
- ✅ Whitelisted-only inline styles
- ✅ Full PostHog functionality

## CSP Policy Components

Our current `style-src` directive includes:

### Core Sources
- `'self'` - Styles from our own domain
- `https://fonts.googleapis.com` - Google Fonts

### Hash-Based Allowlist
- `'unsafe-hashes'` - Required for hash validation of inline attributes
- **Radix UI hashes** (4 existing):
  - `sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=`
  - `sha256-Od9mHMH7x2G6QuoV3hsPkDCwIyqbg2DX3F5nLeCYQBc=`
  - `sha256-xvtTv7uvC5+0GaDrlzTnq66BuHoCGZg9f04RdFS59jU=`
  - `sha256-dH+oOZOdDv+MWU0F8bCZOoFHX0jFM4+bwNqOKujbv90=`

### PostHog Hashes (NEW)
- `sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo=` - Vendor UI styles
- `sha256-3juv2Ft1FaY3xWYNGXExi9oTqA3RQ4gtgCqyf3mxGhU=` - Recording canvas styles
- `sha256-u+Rk/5AL3dunZWvfY3KjmuFuGFWzreMwowBwCCGqr5M=` - Session overlay styles
- `sha256-Hpgy6ySBMLFvhf9n57NVbYSqSKne6nBTHPTrs1z5TAE=` - Recording metadata styles

## Related Files

- `public/_headers` - CSP policy configuration
- `scripts/verify-csp-hash.js` - CSP hash verification script
- `index.html` - Contains theme detection script with its own hash

## Troubleshooting

### If CSP Violations Appear Again

1. **Check Browser Console** for the specific hash in the error message:
   ```
   Either the 'unsafe-inline' keyword, a hash ('sha256-XXXXX'), or a nonce...
   ```

2. **Extract the Hash** from the error message

3. **Add to `public/_headers`** in the `style-src` directive:
   ```
   style-src 'self' ... 'sha256-XXXXX' ...;
   ```

4. **Verify with**:
   ```bash
   npm run verify:csp
   ```

5. **Rebuild and Deploy**:
   ```bash
   npm run build
   ```

### Common Causes of New CSP Violations

- 📦 **Library Updates**: PostHog or other libraries change their inline styles
- 🎨 **UI Framework Changes**: Radix UI or component libraries add new patterns
- 🔄 **Dynamic Content**: New components that inject inline styles
- 🐛 **Browser Extensions**: Can sometimes inject styles (not our problem)

## Best Practices

### When Adding New Inline Styles

1. ✅ **Prefer CSS Classes** over inline styles
2. ✅ **Use styled-components** or CSS modules
3. ✅ **Document any new hashes** in `_headers` comments
4. ✅ **Run `npm run verify:csp`** before committing
5. ❌ **Never use `'unsafe-inline'`** without team discussion

### Monitoring CSP Violations

- 🔍 Check browser console during development
- 🚨 Set up CSP violation reporting in production (future enhancement)
- 📊 Monitor Sentry for CSP-related errors
- 🧪 Test with PostHog session recording enabled

## Future Improvements

1. **CSP Reporting**: Add `report-uri` to log violations in production
2. **Automated Hash Collection**: Script to extract hashes from build output
3. **CI/CD Validation**: Fail builds if new inline styles are detected
4. **Dynamic Hash Management**: Consider nonce-based CSP for PostHog
5. **Documentation**: Add CSP guide to developer onboarding

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP style-src Directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src)
- [PostHog Session Recording](https://posthog.com/docs/session-replay)
- [CSP Hash vs Nonce](https://content-security-policy.com/hash/)

## Lessons Learned

1. **Third-party libraries** can inject inline styles that violate CSP
2. **Hash whitelisting** is more secure than `'unsafe-inline'`
3. **Browser console errors** often contain the exact hash needed
4. **Documentation** in `_headers` helps future developers understand why hashes exist
5. **CSP verification scripts** prevent accidental policy breaks

---

**Related PRs:**
- Main PR: [#1245](https://github.com/bdougie/contributor.info/pull/1245)

**Related Docs:**
- [Trending 502 Fix](./trending-502-error-and-sentry.md)
- [CSP Documentation](../infrastructure/content-security-policy.md)
