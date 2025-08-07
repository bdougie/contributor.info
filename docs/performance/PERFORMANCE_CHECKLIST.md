# Performance Checklist for New Features

Use this checklist when implementing new features to ensure they meet performance standards.

## Pre-Development

- [ ] **Review Performance Budget**
  - [ ] Check current bundle size: `npm run build:analyze`
  - [ ] Estimate feature's size impact
  - [ ] Plan code splitting strategy if > 50KB

- [ ] **Design Review**
  - [ ] Identify heavy components that need lazy loading
  - [ ] Plan progressive enhancement approach
  - [ ] Consider data loading strategy

## During Development

### 🖼️ Images & Media

- [ ] **Optimization**
  - [ ] Convert images to WebP/AVIF format
  - [ ] Compress images (< 100KB for most cases)
  - [ ] Use appropriate sizes (don't load 4K for thumbnails)

- [ ] **Implementation**
  - [ ] Add `width` and `height` attributes
  - [ ] Add `loading="lazy"` for below-fold images
  - [ ] Implement responsive images with `srcset`
  - [ ] Add `alt` text for accessibility

### ⚡ JavaScript

- [ ] **Bundle Management**
  - [ ] Dynamic import for route components
  - [ ] Lazy load non-critical features
  - [ ] Check for duplicate dependencies

- [ ] **Performance Patterns**
  - [ ] Debounce search/filter inputs (min 300ms)
  - [ ] Throttle scroll/resize handlers
  - [ ] Use `useMemo` for expensive calculations
  - [ ] Implement virtual scrolling for > 50 items

- [ ] **Async Operations**
  - [ ] Show loading states immediately
  - [ ] Implement error boundaries
  - [ ] Add request cancellation on unmount

### 🎨 CSS & Styling

- [ ] **Optimization**
  - [ ] Remove unused CSS classes
  - [ ] Use CSS modules or styled-components code splitting
  - [ ] Avoid complex selectors (> 3 levels)

- [ ] **Layout Stability**
  - [ ] Reserve space for dynamic content
  - [ ] Use CSS Grid/Flexbox for responsive layouts
  - [ ] Avoid inline styles that cause reflows

### 📊 Data Loading

- [ ] **Strategy**
  - [ ] Implement 3-stage loading (critical → full → enhanced)
  - [ ] Add skeleton screens for all loading states
  - [ ] Cache API responses appropriately

- [ ] **Implementation**
  ```typescript
  // Example pattern
  const { critical } = useCriticalData();     // < 500ms
  const { full } = useFullData();             // < 2s
  const { enhanced } = useEnhancedData();     // background
  ```

- [ ] **Optimization**
  - [ ] Batch API requests where possible
  - [ ] Implement pagination/infinite scroll
  - [ ] Use field selection to reduce payload

### 🔄 State Management

- [ ] **Optimization**
  - [ ] Minimize re-renders with proper memoization
  - [ ] Split global state to prevent unnecessary updates
  - [ ] Use local state when possible

- [ ] **Implementation**
  - [ ] Implement optimistic updates
  - [ ] Add proper error handling
  - [ ] Clean up subscriptions on unmount

## Pre-Merge Testing

### 🧪 Automated Tests

- [ ] **Unit Tests**
  ```bash
  npm test -- --coverage
  ```
  - [ ] All tests passing
  - [ ] Coverage maintained or improved

- [ ] **Performance Tests**
  ```bash
  npm run test:performance
  ```
  - [ ] Core Web Vitals tests pass
  - [ ] No new long tasks introduced

### 📏 Metrics Validation

- [ ] **Bundle Size**
  ```bash
  npm run build
  npm run build:analyze
  ```
  - [ ] JavaScript < 350KB total
  - [ ] CSS < 100KB total
  - [ ] No single chunk > 200KB

- [ ] **Lighthouse Scores**
  ```bash
  npm run lighthouse
  ```
  - [ ] Performance > 85
  - [ ] Accessibility > 90
  - [ ] Best Practices > 90
  - [ ] SEO > 90

### 🌐 Browser Testing

- [ ] **Core Functionality**
  - [ ] Test in Chrome (latest)
  - [ ] Test in Firefox (latest)
  - [ ] Test in Safari (latest)
  - [ ] Test on mobile device

- [ ] **Performance Testing**
  - [ ] Enable CPU throttling (4x slowdown)
  - [ ] Enable network throttling (Fast 3G)
  - [ ] Check for jank/stuttering
  - [ ] Verify interactions < 200ms

## Post-Deployment

### 📊 Monitoring

- [ ] **Real User Metrics**
  - [ ] Check Web Vitals dashboard after deploy
  - [ ] Monitor for performance alerts
  - [ ] Review user feedback

- [ ] **Synthetic Monitoring**
  - [ ] PageSpeed Insights score maintained
  - [ ] No Lighthouse regressions
  - [ ] Uptime monitoring stable

### 📝 Documentation

- [ ] **Update Docs**
  - [ ] Document any new performance patterns
  - [ ] Update bundle size budget if needed
  - [ ] Add to performance wiki if applicable

## Quick Commands Reference

```bash
# Development
npm run dev                  # Start dev server
npm run build:analyze       # Analyze bundle
npm run lighthouse          # Run Lighthouse

# Testing
npm run test:performance    # Performance tests
npm run test:coverage       # Unit test coverage

# Monitoring
npm run monitor:vitals      # Start RUM monitoring
npm run report:performance  # Generate report
```

## Red Flags 🚩

Stop and reconsider if you encounter:

- Bundle increase > 100KB for a single feature
- Load time > 3 seconds for any page
- Interaction delay > 500ms
- Memory leak detected in profiler
- Frame rate < 30 FPS during animations
- More than 5 API calls for initial render

## Getting Help

- **Before Starting:** Discuss with tech lead for complex features
- **During Development:** Use #performance Slack channel
- **Code Review:** Tag @performance-team for review
- **Post-Deploy Issues:** Check monitoring dashboard first

Remember: It's easier to build performance in from the start than to optimize later!