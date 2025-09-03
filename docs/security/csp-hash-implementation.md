# Content Security Policy (CSP) Hash Implementation

## Overview
This document describes the implementation of CSP script hashing to remove the `unsafe-inline` directive from the script-src policy, improving the application's security posture.

## Changes Made

### 1. Script Hash Implementation
- **File Modified**: `public/_headers`
- **Change**: Replaced `'unsafe-inline'` with `'sha256-YoIj8zlNEIHZsrgiPIQtSoptcYjwV0DTLMInqTH4mvw='` in the script-src directive
- **Purpose**: Allow only the specific theme detection script to run inline while blocking all other inline scripts

### 2. Hash Calculation Script
- **File Created**: `scripts/calculate-csp-hash.js`
- **Purpose**: Calculate SHA-256 hash for the theme detection script
- **Usage**: Run `node scripts/calculate-csp-hash.js` to generate the hash

## How It Works

### Theme Detection Script
The theme detection script in `index.html` (lines 69-84) runs synchronously before React loads to prevent Flash of Unstyled Content (FOUC). This script:
1. Checks localStorage for saved theme preference
2. Falls back to system preference if set to 'system'
3. Applies the appropriate theme class to the document root

### CSP Hash Validation
The browser:
1. Calculates the SHA-256 hash of the inline script content
2. Compares it to the hash in the CSP header
3. Executes the script only if hashes match
4. Blocks any other inline scripts not matching the hash

## Updating the Hash

If the theme detection script needs to be modified:

1. Update the script in `index.html`
2. Update the script content in `scripts/calculate-csp-hash.js` to match EXACTLY (including all whitespace)
3. Run the hash calculation script:
   ```bash
   node scripts/calculate-csp-hash.js
   ```
4. Update the hash in `public/_headers` with the new value
5. Test the application to ensure no CSP violations

## Testing

### Local Testing
1. Build and run the application:
   ```bash
   npm run build
   npm run dev
   ```
2. Open browser developer console
3. Check for CSP violation errors
4. Verify theme switching still works correctly

### Production Testing
After deployment:
1. Monitor browser console for CSP violations
2. Check error reporting services for CSP violation reports
3. Verify theme detection works on first load

## Future Improvements

### Phase 2: Critical CSS (Medium Priority)
- Move critical CSS from `<style>` tag to external file
- Use `<link rel="preload">` for immediate loading
- Alternative: Implement CSS hashing similar to scripts

### Phase 3: React Inline Styles (Low Priority)
- Audit components using inline styles
- Replace with CSS classes where possible
- For dynamic styles, use CSS variables or data attributes
- Consider CSS-in-JS solution that supports CSP nonces

## Security Benefits

1. **XSS Mitigation**: Prevents execution of injected inline scripts
2. **Supply Chain Protection**: Blocks malicious scripts from compromised dependencies
3. **Compliance**: Meets security best practices and compliance requirements
4. **Defense in Depth**: Adds another layer of security alongside other protections

## References
- [MDN: CSP script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)
- [CSP Hash Calculator](https://report-uri.com/home/hash)
- Issue #655: Remove 'unsafe-inline' from Content Security Policy