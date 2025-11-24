# Bug Fixes Documentation

This directory contains detailed documentation for significant bug fixes in the Contributor.info project.

## Recent Fixes

### 2025-11-24: Trending 502 Error & CSP Violations
**PR:** [#1245](https://github.com/bdougie/contributor.info/pull/1245)

Fixed two critical issues affecting the `/trending` page and browser console:

1. **[Trending 502 Error](./trending-502-error-and-sentry.md)**
   - ✅ Fixed 502 Bad Gateway on `/trending` endpoint
   - ✅ Corrected RPC function name mismatch
   - ✅ Added comprehensive Sentry error tracking
   - **Impact:** Users can now view trending repositories

2. **[PostHog CSP Violations](./posthog-csp-violations.md)**
   - ✅ Fixed Content Security Policy violations
   - ✅ Added PostHog session recording style hashes
   - ✅ Maintained strict CSP security posture
   - **Impact:** Clean browser console, better debugging experience

## Index of All Fixes

### API & Backend Fixes
- [Trending 502 Error and Sentry Setup](./trending-502-error-and-sentry.md) (2025-11-24)
- [PR 1087 Manual Backfill 404 Fix](./pr-1087-manual-backfill-404-fix.md) (existing)

### Security & CSP Fixes
- [PostHog CSP Violations](./posthog-csp-violations.md) (2025-11-24)

## How to Use This Documentation

Each fix document includes:
- **Problem Description** - What went wrong and why
- **Root Cause Analysis** - Technical details of the issue
- **Solution** - Step-by-step fix implementation
- **Testing** - Verification steps
- **Benefits** - Impact of the fix
- **Related Files** - Code references
- **Lessons Learned** - Key takeaways

## Contributing

When documenting a fix:
1. Create a new markdown file in this directory
2. Follow the template structure from existing fixes
3. Include code snippets, before/after comparisons
4. Add troubleshooting guidance
5. Update this README with a link to the new fix

## Template Structure

```markdown
# Fix Title

**Date:** YYYY-MM-DD
**PR:** #[number]
**Status:** ✅ Fixed | 🚧 In Progress | 🔄 Monitoring

## Problem
[What went wrong]

## Root Cause
[Technical analysis]

## Solution
[Implementation details]

## Testing
[Verification steps]

## Benefits
[Impact and improvements]

## Related Files
[Code references]

## Lessons Learned
[Key takeaways]
```

## Related Documentation

- [Architecture Documentation](../architecture/)
- [Debugging Guides](../debugging/)
- [Feature Documentation](../features/)
- [Postmortem Reports](../postmortems/)
