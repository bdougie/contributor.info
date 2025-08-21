# Safe FCP/LCP Optimization Strategies

**Last Updated:** 2025-08-21

## Current Performance Issues (After Bundle Splitting Attempt)
- **FCP**: 4.1-4.3s (target < 1.8s)
- **LCP**: 4.4-5.2s (target < 2.5s)
- **Main Bundle**: 859KB (reduced from 1,158KB)
- **Vendor-React**: 1,231KB (contains ALL React ecosystem)
- **Lighthouse Score**: 65-70 (target 80+)

## Why We Can't Split React Vendor Bundle

### Historical Context
1. **[Production Deployment Postmortem (2025-06-22)](../postmortem/production-deployment-2025-06-22.md)**: First discovered the issue
2. **[Bundle Splitting Attempt (2025-08-21)](../postmortem/bundle-splitting-attempt-2025-08-21.md)**: Confirmed through extensive testing

### Confirmed Constraints
Through multiple attempts in this specific implementation, we've found that these libraries cause initialization errors when separated from React in our Vite build configuration:
- **Radix UI**: Uses `React.forwardRef` at initialization
- **Nivo**: Uses `React.memo` at initialization
- **Recharts/D3**: Complex interdependencies with React internals
- **App Components**: Use `React.createContext` and other hooks

In our current implementation, React and all React-dependent UI/visualization libraries are bundled together, resulting in a ~1.2MB vendor chunk.

## Safe Optimization Strategies

### 1. Resource Hints (Immediate Win)
Add DNS prefetch and preconnect for external resources:

```html
<!-- index.html -->
<link rel="dns-prefetch" href="https://egcxzonpmmcirmgqdrla.supabase.co">
<link rel="preconnect" href="https://egcxzonpmmcirmgqdrla.supabase.co" crossorigin>
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
```

**Impact**: 100-300ms faster connection to critical services

### 2. Critical CSS Inlining
Move above-the-fold CSS inline to eliminate render-blocking:

```html
<style>
  /* Critical CSS for initial render */
  body { margin: 0; font-family: system-ui; }
  .skeleton { animation: pulse 2s infinite; }
  /* ... minimal CSS for loader */
</style>
<link rel="preload" href="/css/main.css" as="style">
<link rel="stylesheet" href="/css/main.css" media="print" onload="this.media='all'">
```

**Impact**: 200-500ms faster FCP

### 3. Service Worker with Cache-First Strategy
Implement aggressive caching for static assets:

```javascript
// sw.js
const CACHE_NAME = 'v1';
const urlsToCache = [
  '/',
  '/css/index.css',
  '/js/react-vendor.js', // Cache the big bundle
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

**Impact**: 2-3s faster on repeat visits

### 4. Optimize Font Loading
Use font-display: swap and subset fonts:

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap; /* Show fallback immediately */
  unicode-range: U+0000-00FF; /* Latin subset only */
}
```

**Impact**: 100-200ms faster text rendering

### 5. Lazy Load Below-the-Fold Content
Use Intersection Observer for components:

```typescript
const LazyComponent = lazy(() => 
  new Promise(resolve => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        import('./HeavyComponent').then(resolve);
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById('lazy-trigger'));
  })
);
```

**Impact**: Defer 100-200KB of JavaScript

### 6. HTTP/2 Server Push (Netlify Headers)
Configure Netlify to push critical resources:

```toml
# netlify.toml
[[headers]]
  for = "/"
  [headers.values]
    Link = "</js/react-vendor.js>; rel=preload; as=script, </css/index.css>; rel=preload; as=style"
```

**Impact**: 200-400ms faster resource delivery

### 7. Optimize Images with AVIF/WebP
Serve modern formats with fallbacks:

```html
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" loading="lazy">
</picture>
```

**Impact**: 30-50% smaller image sizes

### 8. Reduce Third-Party Impact
Load analytics and monitoring asynchronously:

```javascript
// Defer non-critical third-party scripts
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    // Load analytics, monitoring, etc.
  });
} else {
  setTimeout(() => {
    // Fallback loading
  }, 1);
}
```

**Impact**: 100-300ms faster initial load

## Implementation Priority

1. **High Impact, Low Risk**:
   - Resource hints (5 min)
   - Font optimization (10 min)
   - HTTP/2 push (10 min)

2. **Medium Impact, Medium Risk**:
   - Critical CSS inlining (1 hour)
   - Service Worker (2 hours)

3. **Lower Impact, Higher Complexity**:
   - Lazy loading below-fold (2-4 hours)
   - Image optimization (1-2 hours)

## Expected Results

Combining these optimizations should achieve:
- **FCP**: ~2.0s (2.1s improvement)
- **LCP**: ~2.5s (1.9s improvement)
- **Repeat visits**: <1s with Service Worker

## Monitoring

Track improvements with:
- Lighthouse CI in GitHub Actions
- Real User Monitoring (RUM) at `/admin/performance`
- PageSpeed Insights weekly checks

## References
- [Web.dev Performance Guide](https://web.dev/performance/)
- [Netlify Headers Documentation](https://docs.netlify.com/routing/headers/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)