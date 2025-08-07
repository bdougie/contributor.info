# Performance Best Practices

## Overview

This document outlines performance best practices for maintaining and improving Core Web Vitals on contributor.info. Following these guidelines ensures our application meets Google's performance standards and provides an excellent user experience.

## Core Web Vitals Targets

| Metric | Target | Description |
|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time to render the largest content element |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness to user interactions |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability during page load |
| **FCP** (First Contentful Paint) | < 1.8s | Time to first content render |
| **TTFB** (Time to First Byte) | < 800ms | Server response time |

## Development Guidelines

### 1. Code Splitting

**✅ DO:**
- Use dynamic imports for route-based code splitting
- Lazy load heavy components that aren't immediately visible
- Split vendor bundles from application code

```typescript
// Good - Lazy load heavy components
const Dashboard = lazy(() => import('./Dashboard'));

// Good - Route-based splitting
const routes = {
  '/dashboard': () => import('./pages/Dashboard'),
  '/settings': () => import('./pages/Settings'),
};
```

**❌ DON'T:**
- Import everything in the main bundle
- Load all routes upfront

### 2. Image Optimization

**✅ DO:**
- Use modern image formats (WebP, AVIF)
- Implement lazy loading for below-fold images
- Specify width and height to prevent CLS
- Use responsive images with srcset

```html
<!-- Good -->
<img 
  src="avatar.webp" 
  alt="User" 
  width="48" 
  height="48" 
  loading="lazy"
/>
```

**❌ DON'T:**
- Use unoptimized images
- Omit dimensions causing layout shifts
- Load all images immediately

### 3. JavaScript Performance

**✅ DO:**
- Debounce expensive operations
- Use Web Workers for heavy computations
- Implement virtual scrolling for long lists
- Memoize expensive calculations

```typescript
// Good - Debounce search input
const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  []
);

// Good - Virtualize long lists
<VirtualizedList 
  items={contributors}
  itemHeight={100}
/>
```

**❌ DON'T:**
- Run expensive operations on every render
- Render thousands of DOM nodes
- Block the main thread with long tasks

### 4. CSS Optimization

**✅ DO:**
- Use CSS containment for complex layouts
- Minimize critical CSS
- Avoid complex selectors
- Use CSS transforms for animations

```css
/* Good - Use containment */
.card {
  contain: layout style paint;
}

/* Good - Use transforms */
.animate {
  transform: translateX(100px);
  will-change: transform;
}
```

**❌ DON'T:**
- Animate properties that trigger layout
- Use excessive CSS-in-JS at runtime
- Include unused CSS

### 5. Data Loading Patterns

**✅ DO:**
- Implement progressive data loading
- Cache API responses
- Use optimistic updates
- Show skeletons during loading

```typescript
// Good - Progressive loading
const useProgressiveData = () => {
  // 1. Load critical data first
  const critical = useCriticalData();
  
  // 2. Load full data
  const full = useFullData(critical);
  
  // 3. Load enhancements in background
  const enhanced = useEnhancedData(full);
  
  return { critical, full, enhanced };
};
```

**❌ DON'T:**
- Load all data upfront
- Block UI while fetching
- Make waterfall requests

## Performance Monitoring

### 1. Real User Monitoring (RUM)

We track Core Web Vitals for all users:

```typescript
// Automatically tracked metrics
- LCP, INP, CLS, FCP, TTFB
- Device and connection info
- Page-specific performance
```

Access dashboard at `/admin/performance`

### 2. Synthetic Monitoring

Automated tests run on every PR:
- PageSpeed Insights scores
- Lighthouse CI assertions
- Bundle size checks
- Performance budgets

### 3. Performance Budgets

| Resource | Budget | Action |
|----------|--------|--------|
| JavaScript | < 350KB | Block PR |
| CSS | < 100KB | Warning |
| Images | < 500KB | Warning |
| Total | < 2MB | Block PR |

## Testing Performance

### Local Testing

```bash
# Run Lighthouse locally
npm run lighthouse

# Check bundle size
npm run build:analyze

# Run performance tests
npm run test:performance
```

### CI/CD Testing

Performance tests run automatically on:
- Every PR (compare against main)
- Daily scheduled runs
- Manual workflow dispatch

### Manual Testing

1. **Chrome DevTools**
   - Performance tab for profiling
   - Lighthouse for Core Web Vitals
   - Network tab for waterfall analysis

2. **PageSpeed Insights**
   - Test production URLs
   - Get field data from real users
   - Receive optimization suggestions

## Common Performance Issues

### Issue: High LCP

**Symptoms:** Main content takes > 2.5s to render

**Solutions:**
- Optimize server response time (TTFB)
- Preload critical resources
- Optimize images and fonts
- Remove render-blocking resources

### Issue: Poor INP

**Symptoms:** Slow response to user interactions

**Solutions:**
- Break up long tasks
- Use `requestIdleCallback` for non-urgent work
- Debounce input handlers
- Optimize event listeners

### Issue: High CLS

**Symptoms:** Layout shifts during loading

**Solutions:**
- Set dimensions on images/videos
- Reserve space for dynamic content
- Avoid inserting content above existing content
- Use CSS transforms instead of position changes

## Performance Checklist

Use this checklist when implementing new features:

- [ ] **Images**
  - [ ] Optimized format (WebP/AVIF)
  - [ ] Lazy loading enabled
  - [ ] Dimensions specified
  - [ ] Responsive srcset

- [ ] **JavaScript**
  - [ ] Code split if > 50KB
  - [ ] Lazy loaded if not critical
  - [ ] Debounced expensive operations
  - [ ] No blocking scripts

- [ ] **CSS**
  - [ ] Critical CSS inlined
  - [ ] Non-critical CSS deferred
  - [ ] No unused styles
  - [ ] Animations use transforms

- [ ] **Data Loading**
  - [ ] Progressive loading implemented
  - [ ] Skeleton screens shown
  - [ ] Caching implemented
  - [ ] No waterfall requests

- [ ] **Testing**
  - [ ] Lighthouse score > 85
  - [ ] Core Web Vitals pass
  - [ ] Bundle size within budget
  - [ ] No console errors

## Tools and Resources

### Monitoring Tools
- [Web Vitals Chrome Extension](https://chrome.google.com/webstore/detail/web-vitals/ahfhijdlegdabablpippeagghigmibma)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- Internal Dashboard: `/admin/performance`

### Documentation
- [Web.dev Performance](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Chrome User Experience Report](https://developers.google.com/web/tools/chrome-user-experience-report)

### NPM Scripts
```bash
npm run lighthouse        # Run Lighthouse audit
npm run build:analyze    # Analyze bundle size
npm run test:performance # Run performance tests
npm run monitor:vitals   # Start RUM monitoring
```

## Getting Help

- **Slack:** #performance channel
- **Wiki:** Internal performance wiki
- **Monitoring:** Check dashboard for trends
- **Alerts:** Performance regressions auto-reported in PRs

## Enforcement

Performance standards are enforced through:

1. **Automated PR checks** - Fail if budgets exceeded
2. **Required reviews** - Performance team reviews for major changes
3. **Monitoring alerts** - Slack notifications for regressions
4. **Monthly reviews** - Team reviews performance metrics

Remember: **Performance is a feature**, not an afterthought. Every millisecond counts!