# PostHog Web Vitals Integration

## Overview

This document describes the PostHog integration for tracking Web Vitals in the contributor.info application. The implementation uses lazy loading to minimize bundle impact while providing real user monitoring capabilities.

## Implementation Details

### Lazy Loading Architecture

PostHog is loaded dynamically only when needed, resulting in minimal bundle impact:
- Lazy loader module: 1.64KB (0.89KB gzipped)
- PostHog library: Loaded on-demand via dynamic import

### Files

- `/src/lib/posthog-lazy.ts` - Lazy loading module for PostHog
- `/src/lib/web-vitals-analytics.ts` - Analytics integration with PostHog support
- `/src/lib/web-vitals-monitoring.ts` - Core Web Vitals monitoring

## Configuration

### Environment Variables

```bash
# PostHog Configuration
VITE_POSTHOG_KEY=your-posthog-project-api-key
VITE_POSTHOG_HOST=https://us.i.posthog.com  # Optional, defaults to US instance
```

### CSP Headers

The Content Security Policy headers in `/public/_headers` include PostHog domains:

```
Content-Security-Policy: 
  script-src 'self' https://*.posthog.com https://us.i.posthog.com;
  connect-src 'self' https://*.posthog.com https://us.i.posthog.com;
```

## Features

### Automatic Opt-Out

- Disabled by default in development
- Users can opt-out via `localStorage.setItem('posthog_opt_out', 'true')`
- Respects user privacy preferences

### Minimal Configuration

PostHog is configured with minimal features to reduce performance overhead:
- `autocapture: false` - No automatic event capture
- `capture_pageview: false` - Manual page view tracking if needed
- `disable_session_recording: true` - No session recording
- `advanced_disable_decide: false` - No feature flag evaluation

### Web Vitals Tracked

The following Core Web Vitals are tracked:
- **LCP** (Largest Contentful Paint) - Target: < 2.5s
- **INP** (Interaction to Next Paint) - Target: < 200ms
- **CLS** (Cumulative Layout Shift) - Target: < 0.1
- **FCP** (First Contentful Paint) - Target: < 1.8s
- **TTFB** (Time to First Byte) - Target: < 800ms

## Usage

### Enable in Development

To enable PostHog in development for testing:

```javascript
// In browser console
localStorage.setItem('enablePostHogDev', 'true');
location.reload();
```

### Disable in Development

```javascript
// In browser console
localStorage.removeItem('enablePostHogDev');
location.reload();
```

### Manual Opt-Out

Users can opt-out of PostHog tracking:

```javascript
// In browser console or application code
import { optOutOfPostHog } from './lib/posthog-lazy';
await optOutOfPostHog();
```

## Performance Impact

The lazy loading implementation ensures minimal performance impact:

1. **Initial Bundle**: Only 1.64KB added to initial bundle
2. **Dynamic Loading**: PostHog library (~60KB) loaded only when:
   - Environment has POSTHOG_KEY configured
   - User hasn't opted out
   - Web Vitals are being tracked
3. **Caching**: PostHog library cached after first load
4. **Batching**: Metrics batched to reduce network requests

## Data Flow

1. Web Vitals are collected by `web-vitals-monitoring.ts`
2. Metrics sent to `web-vitals-analytics.ts`
3. Analytics module checks enabled providers (Supabase, PostHog)
4. If PostHog enabled, lazy loads PostHog library
5. Metrics sent to PostHog for aggregation and analysis

## Testing

### Verify PostHog Integration

1. Set environment variable: `VITE_POSTHOG_KEY=your-key`
2. Build the application: `npm run build`
3. Check bundle size: Look for `posthog-lazy-*.js` (~1.64KB)
4. Open DevTools Network tab
5. Navigate the application
6. Verify PostHog library loads on first metric
7. Check PostHog dashboard for Web Vitals events

### Bundle Size Verification

```bash
# Build with analysis
npm run build:analyze

# Check for posthog-lazy chunk (should be ~1.64KB)
# PostHog library should NOT be in main bundle
```

## Troubleshooting

### PostHog Not Loading

1. Check environment variable: `VITE_POSTHOG_KEY`
2. Verify not opted out: Check localStorage for `posthog_opt_out`
3. In development: Check `enablePostHogDev` in localStorage
4. Check browser console for errors

### CSP Errors

If seeing Content Security Policy errors:
1. Verify CSP headers include PostHog domains
2. Check for custom CSP meta tags in HTML
3. Ensure both script-src and connect-src allow PostHog

### Metrics Not Appearing

1. Check PostHog dashboard for `web_vitals` events
2. Verify network requests to PostHog succeed
3. Check browser console for tracking errors
4. Ensure Web Vitals are being collected (check console logs)

## Migration from PageSpeed Insights

The application has migrated from PageSpeed Insights API to PostHog for Web Vitals tracking:

- **Removed**: `pagespeed-insights.ts` and API dependencies
- **Added**: PostHog lazy loading integration
- **Updated**: `compare-web-vitals.js` to use Lighthouse CI only
- **Benefit**: Real user monitoring vs synthetic testing

## Future Enhancements

Potential improvements for the PostHog integration:

1. **Custom Dashboards**: Create PostHog dashboards for Web Vitals
2. **Alerting**: Set up alerts for performance regressions
3. **Segmentation**: Track metrics by user segments
4. **A/B Testing**: Use PostHog feature flags for performance experiments
5. **Session Replay**: Selectively enable for debugging (with user consent)