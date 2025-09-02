# PRD: Remove 'unsafe-inline' from Content Security Policy

## Project Overview

### Objective
Remove the 'unsafe-inline' directive from our Content Security Policy to enhance security against XSS attacks.

### Background
While we've successfully removed 'unsafe-eval', we still rely on 'unsafe-inline' for scripts and styles. This directive weakens our CSP and should be replaced with more secure alternatives like nonces or hashes.

### Success Metrics
- Complete removal of 'unsafe-inline' from script-src and style-src
- Application functions normally without CSP violations
- No regression in functionality or user experience

## Current State Analysis

### What Requires 'unsafe-inline'

#### Scripts
1. **Theme Detection Script** (index.html:69-84)
   - Prevents flash of unstyled content (FOUC)
   - Runs synchronously before React loads
   - Sets initial theme based on localStorage/system preference

#### Styles
1. **Critical CSS** (index.html:87-114)
   - Above-the-fold styles for instant rendering
   - Theme variables and base utilities
   - Loading skeleton animations

2. **React Inline Styles**
   - Dynamic style props throughout components
   - Styled-components runtime styles
   - Tailwind's dynamic utilities

## Implementation Plan

### Phase 1: Script Refactoring (HIGH Priority)

#### Option A: Script Hashing
- Calculate SHA256 hash of the theme detection script
- Add hash to CSP: `script-src 'self' 'sha256-[hash]'`
- Update build process to maintain consistent hashes

#### Option B: Nonce-based Approach
- Generate random nonce on each page load
- Add nonce to script tag and CSP header
- Requires server-side rendering or edge functions

**Acceptance Criteria:**
- ✅ Theme detection script works with hash/nonce
- ✅ No FOUC on page load
- ✅ CSP violations eliminated for inline scripts

### Phase 2: Critical CSS Migration (MEDIUM Priority)

#### Approach
1. Move critical CSS to external file
2. Use `<link rel="preload">` for immediate loading
3. Or implement CSS hashing similar to scripts

**Acceptance Criteria:**
- ✅ Critical styles load without delay
- ✅ No layout shift or FOUC
- ✅ Style-src no longer needs 'unsafe-inline' for critical CSS

### Phase 3: React Inline Styles Refactoring (LOW Priority)

#### Approach
1. Audit all components using inline styles
2. Replace with CSS classes where possible
3. For dynamic styles, use CSS variables or data attributes
4. Consider CSS-in-JS solution that supports CSP nonces

**Components to Refactor:**
- Components with `style=` props
- Styled-components dynamic styles
- Third-party libraries requiring inline styles

**Acceptance Criteria:**
- ✅ All inline styles replaced or secured
- ✅ Complete removal of 'unsafe-inline' from style-src
- ✅ No visual regressions

## Technical Guidelines

### CSP Header Generation
- Implement dynamic CSP header generation if using nonces
- Consider using Netlify Edge Functions for nonce injection
- Maintain separate CSP for development vs production

### Build Process Updates
- Update Vite config for hash generation
- Ensure consistent hashes across builds
- Document hash update process

### Testing Strategy
1. Local testing with strict CSP
2. Preview deployment verification
3. Browser compatibility testing
4. Performance impact assessment

## Risks and Mitigations

### Risks
1. **Build Complexity**: Hash/nonce management adds complexity
2. **Performance**: Additional processing for CSP headers
3. **Third-party Libraries**: May require inline styles
4. **Browser Support**: Older browsers may not support CSP3

### Mitigations
1. Thorough documentation of build process
2. Performance monitoring and optimization
3. Gradual rollout with fallbacks
4. Progressive enhancement approach

## References
- [MDN: CSP script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)
- [Using CSP Nonces](https://content-security-policy.com/nonce/)
- [CSP Hash Calculator](https://report-uri.com/home/hash)
- [Netlify Edge Functions](https://docs.netlify.com/edge-functions/overview/)