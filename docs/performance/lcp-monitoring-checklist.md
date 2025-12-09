# LCP Monitoring Setup Checklist

Quick reference for configuring PostHog LCP monitoring and alerts.

**Full Guide:** [PostHog LCP Monitoring Setup](./posthog-lcp-monitoring-setup.md)

---

## Initial Setup

### Prerequisites
- [ ] Verify `VITE_POSTHOG_KEY` in Netlify environment variables
- [ ] Confirm Web Vitals tracking enabled in production
- [ ] Test PostHog connection in browser console

### Dashboard Creation
- [ ] Create "Core Web Vitals - Production" dashboard
- [ ] Add LCP Over Time panel (p75, 30 days)
- [ ] Add LCP Distribution panel (good/needs-improvement/poor)
- [ ] Add LCP by Page panel (top 20 slowest)
- [ ] Add LCP vs. Target goal chart (2500ms threshold)
- [ ] Add All Core Web Vitals summary cards
- [ ] Add Performance Rating Distribution percentage

### Alert Configuration
- [ ] Create "LCP Threshold Violation" alert (p75 > 2500ms)
- [ ] Create "LCP Regression Detection" alert (20% increase)
- [ ] Create "Good LCP Rate Drop" alert (<75% good rating)
- [ ] Configure Slack notifications (#performance-alerts)
- [ ] Configure email notifications (engineering team)
- [ ] Test alerts with "Test Now" button

---

## PR #1282 Specific Monitoring

### Baseline Collection (Pre-Deploy)
- [ ] Record LCP p75 baseline: _________ ms
- [ ] Record Good LCP Rate: _________ %
- [ ] Record Page Load Time: _________ s
- [ ] Document date range: ________________

### Post-Deploy Monitoring (First 24 Hours)
- [ ] Monitor LCP dashboard every 2 hours
- [ ] Check for alert triggers
- [ ] Compare LCP p75 to baseline
- [ ] Verify auth flow performance
- [ ] Check error rates in Sentry
- [ ] Review bundle size impact

### Success Verification (24-48 Hours)
- [ ] LCP p75 reduced by 200-500ms ✅ / ❌
- [ ] Good LCP Rate increased >5% ✅ / ❌
- [ ] No increase in error rates ✅ / ❌
- [ ] No auth flow regressions ✅ / ❌
- [ ] Zero false positive alerts ✅ / ❌

---

## Daily Operations

### Morning Check (5 minutes)
- [ ] Open PostHog LCP dashboard
- [ ] Review overnight metrics
- [ ] Check for alert history
- [ ] Verify data collection (no gaps)

### Weekly Review (15 minutes)
- [ ] Analyze LCP trends over 7 days
- [ ] Identify slowest pages (top 10)
- [ ] Check alert accuracy
- [ ] Update team in Slack #performance

### Monthly Audit (30 minutes)
- [ ] Review alert thresholds
- [ ] Generate performance report
- [ ] Analyze LCP by browser/device/connection
- [ ] Document action items

---

## Troubleshooting Quick Reference

### Metrics Not Appearing
1. Check `VITE_POSTHOG_KEY` environment variable
2. Verify CSP headers include PostHog domains
3. Check browser console for errors
4. Enable debug mode: `localStorage.setItem('WEB_VITALS_DEBUG', 'true')`

### Alerts Not Triggering
1. Verify event volume (>50 events/hour)
2. Test alert manually with "Test Now"
3. Check alert history for false positives
4. Confirm Slack webhook configured

### High LCP Values
1. Check recent deployments
2. Review Sentry for correlated errors
3. Analyze slowest pages in PostHog
4. Run Lighthouse CI locally
5. Investigate bundle size increase

---

## Key Metrics Reference

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** | <2.5s | 2.5-4.0s | >4.0s |
| **INP** | <200ms | 200-500ms | >500ms |
| **CLS** | <0.1 | 0.1-0.25 | >0.25 |
| **FCP** | <1.8s | 1.8-3.0s | >3.0s |
| **TTFB** | <800ms | 800-1800ms | >1800ms |

### Target Percentiles
- **p50:** 50th percentile (median)
- **p75:** 75th percentile (recommended for monitoring)
- **p90:** 90th percentile (tail performance)
- **p95:** 95th percentile (worst case tracking)

---

## Contact

- **Slack:** #performance-monitoring
- **Dashboard:** [PostHog Core Web Vitals](https://us.posthog.com/dashboard/...)
- **Alerts:** [PostHog Alerts](https://us.posthog.com/alerts)
- **Documentation:** [Full Setup Guide](./posthog-lcp-monitoring-setup.md)

---

**Quick Links:**
- [PR #1282 Audit](../implementations/pr-1282-supabase-lazy-loading-audit.md)
- [Web Vitals Integration](./posthog-web-vitals.md)
- [Performance Best Practices](./performance-best-practices.md)

---

**Last Updated:** 2025-12-09
