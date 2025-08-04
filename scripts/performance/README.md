# Performance Scripts

Tools for analyzing, monitoring, and optimizing application performance across web, mobile, and infrastructure.

## 🚀 Overview

Performance scripts help:
- Identify bottlenecks and optimization opportunities
- Monitor real-time performance metrics
- Analyze bundle sizes and load times
- Track database and CDN performance

## 📊 Scripts

### Analysis Tools

| Script | Purpose | Key Metrics |
|--------|---------|-------------|
| `analyze-bundle.js` | Analyze JavaScript bundle sizes | Bundle size, code splitting |
| `analyze-mobile-performance.js` | Mobile-specific performance metrics | Touch responsiveness, viewport |
| `performance-check.js` | Comprehensive performance audit | All metrics combined |
| `lighthouse-check.js` | Run Lighthouse audits | Core Web Vitals, SEO |

### Monitoring Tools

| Script | Purpose | Key Metrics |
|--------|---------|-------------|
| `monitor-cdn-performance.js` | CDN and asset delivery | Cache hit rate, latency |
| `monitor-database-performance.js` | Database query performance | Query time, connection pool |

## 💡 Usage Examples

### Pre-Release Performance Audit
```bash
# Full performance check
node scripts/performance/performance-check.js

# Bundle size analysis
node scripts/performance/analyze-bundle.js

# Lighthouse audit
node scripts/performance/lighthouse-check.js --url https://contributor.info
```

### Mobile Optimization
```bash
# Analyze mobile performance
node scripts/performance/analyze-mobile-performance.js

# Check specific device profiles
node scripts/performance/analyze-mobile-performance.js --device "iPhone 12"
```

### Infrastructure Monitoring
```bash
# Check database performance
node scripts/performance/monitor-database-performance.js

# Monitor CDN effectiveness
node scripts/performance/monitor-cdn-performance.js --region us-west-2
```

## 📈 Key Metrics

### Core Web Vitals
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### Bundle Metrics
- **Initial Bundle**: < 200KB
- **Lazy Loaded**: < 50KB per chunk
- **Total Size**: < 1MB

### Database Performance
- **Query Time**: < 100ms average
- **Connection Pool**: < 80% utilization
- **Cache Hit Rate**: > 90%

## 🔧 Configuration

### Performance Budgets
```json
{
  "bundles": {
    "main": { "maxSize": "200KB" },
    "vendor": { "maxSize": "300KB" }
  },
  "metrics": {
    "lcp": { "budget": 2500 },
    "fid": { "budget": 100 },
    "cls": { "budget": 0.1 }
  }
}
```

### Monitoring Thresholds
```bash
# Set custom thresholds
PERF_LCP_THRESHOLD=2000
PERF_BUNDLE_THRESHOLD=150000
PERF_QUERY_THRESHOLD=50
```

## 📊 Output Examples

### Bundle Analysis
```
Bundle Analysis Results:
├── main.js: 178KB (gzipped: 52KB)
├── vendor.js: 245KB (gzipped: 78KB)
└── chunks/
    ├── dashboard: 45KB
    └── profile: 38KB

Total: 506KB (within budget ✓)
```

### Performance Metrics
```
Performance Check Results:
├── LCP: 1.8s ✓
├── FID: 45ms ✓
├── CLS: 0.05 ✓
├── TTI: 2.1s ✓
└── Score: 95/100
```

## 🚨 Alerts & Actions

### Performance Regressions
When metrics exceed thresholds:
1. Script exits with error code
2. Detailed report generated
3. Suggestions for optimization

### Common Optimizations
- **Large Bundles**: Enable code splitting
- **Slow LCP**: Optimize images, preload critical resources
- **High CLS**: Set dimensions on images/videos
- **Database**: Add indexes, optimize queries

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
- name: Performance Check
  run: |
    npm run performance:check
    npm run bundle:analyze
```

### Pre-commit Hooks
```bash
# Add to .git/hooks/pre-commit
node scripts/performance/analyze-bundle.js --fail-on-increase
```

## 📚 Best Practices

1. **Regular Monitoring**: Run checks weekly
2. **Budget Enforcement**: Fail builds on violations
3. **Trend Analysis**: Track metrics over time
4. **Device Testing**: Test on real devices
5. **Network Conditions**: Test on 3G/4G

## 🆘 Troubleshooting

### "Bundle size increased"
- Run `analyze-bundle.js` with `--details`
- Check for duplicate dependencies
- Enable tree shaking

### "Database queries slow"
- Run `monitor-database-performance.js --explain`
- Check for missing indexes
- Review query patterns

### "Poor mobile performance"
- Reduce JavaScript execution
- Optimize images for mobile
- Implement virtual scrolling