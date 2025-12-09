# PostHog LCP Monitoring Setup

## Overview

Complete guide for setting up production LCP (Largest Contentful Paint) monitoring using PostHog Web Vitals dashboard and automated alerting for performance regressions.

**Related:** [PR #1282 Supabase Lazy Loading Audit](../implementations/pr-1282-supabase-lazy-loading-audit.md)

---

## Quick Start

### 1. Prerequisites

- PostHog project with API key configured
- `VITE_POSTHOG_KEY` environment variable set in Netlify
- Web Vitals monitoring enabled (auto-enabled in production)

### 2. Verify Integration

```bash
# Check environment variable
netlify env:list | grep POSTHOG

# Test locally (requires PostHog key)
localStorage.setItem('enablePostHogDev', 'true');
location.reload();
```

---

## Dashboard Setup

### Creating the Web Vitals Dashboard

1. **Navigate to PostHog:**
   - Go to: https://us.posthog.com (or your PostHog instance)
   - Select your project

2. **Create New Dashboard:**
   - Click "Dashboards" → "New Dashboard"
   - Name: "Core Web Vitals - Production"
   - Description: "Real user monitoring for LCP, INP, CLS, FCP, TTFB"

3. **Add LCP Tracking Panel:**

   **Panel 1: LCP Over Time (Line Chart)**
   ```
   Event: web_vitals
   Filter: name = LCP
   Aggregate: p75(value)
   Group by: Day
   Time range: Last 30 days
   ```

   **Panel 2: LCP Distribution (Histogram)**
   ```
   Event: web_vitals
   Filter: name = LCP
   Breakdown: rating (good/needs-improvement/poor)
   Visualization: Bar chart
   Time range: Last 7 days
   ```

   **Panel 3: LCP p75 by Page (Table)**
   ```
   Event: web_vitals
   Filter: name = LCP
   Aggregate: p75(value)
   Group by: url
   Sort by: p75(value) DESC
   Limit: 20
   ```

   **Panel 4: LCP vs. Target (Goal Chart)**
   ```
   Event: web_vitals
   Filter: name = LCP
   Metric: p75(value)
   Goal line: 2500ms
   Visualization: Line chart with threshold
   ```

4. **Add Supporting Metrics:**

   **Panel 5: All Core Web Vitals Summary**
   ```
   Event: web_vitals
   Metrics:
     - LCP p75: p75(value WHERE name=LCP)
     - INP p75: p75(value WHERE name=INP)
     - CLS p75: p75(value WHERE name=CLS)
     - FCP p75: p75(value WHERE name=FCP)
     - TTFB p75: p75(value WHERE name=TTFB)
   Visualization: Number cards
   ```

   **Panel 6: Performance Rating Distribution**
   ```
   Event: web_vitals
   Filter: name = LCP
   Formula: (count WHERE rating=good) / count(*)
   Visualization: Percentage
   Time range: Last 7 days
   ```

---

## Alert Configuration

### Creating LCP Threshold Alert

1. **Navigate to Alerts:**
   - Go to "Alerts" → "New Alert"

2. **Configure Alert: LCP Exceeds 2.5s**

   ```yaml
   Name: "LCP Threshold Violation - Production"
   
   Trigger:
     Event: web_vitals
     Filter: name = LCP
     Metric: p75(value)
     Condition: > 2500
     Time window: Last 1 hour
     Minimum events: 100
   
   Notification:
     Channels:
       - Slack: #performance-alerts
       - Email: engineering@contributor.info
     
   Message Template:
     "🚨 LCP Alert: p75 exceeded 2.5s threshold
      Current: {metric_value}ms
      Target: 2500ms
      Time: {timestamp}
      Dashboard: {dashboard_link}"
   ```

3. **Configure Alert: LCP Regression Detection**

   ```yaml
   Name: "LCP Regression - 20% Increase"
   
   Trigger:
     Event: web_vitals
     Filter: name = LCP
     Metric: p75(value)
     Condition: > previous_period * 1.2
     Time window: Last 1 hour vs. Previous week same hour
     Minimum events: 50
   
   Notification:
     Channels:
       - Slack: #performance-alerts
     
   Message Template:
     "⚠️ LCP Regression Detected
      Current: {current_value}ms
      Baseline: {baseline_value}ms
      Change: +{percentage_change}%
      Investigate: {dashboard_link}"
   ```

4. **Configure Alert: Good LCP Rate Drop**

   ```yaml
   Name: "Good LCP Rate Below 75%"
   
   Trigger:
     Event: web_vitals
     Filter: name = LCP AND rating = good
     Formula: (count WHERE rating=good) / count(*) * 100
     Condition: < 75
     Time window: Last 2 hours
     Minimum events: 100
   
   Notification:
     Channels:
       - Slack: #performance-alerts
     
   Message Template:
     "📉 Good LCP Rate Dropped
      Current: {good_rate}%
      Target: >75%
      Time: {timestamp}"
   ```

---

## Monitoring PR #1282 Impact

### Baseline Metrics (Pre-Deployment)

```yaml
Baseline Period: December 1-8, 2025
Expected Metrics:
  - LCP p75: ~5200ms
  - Good LCP Rate: ~45%
  - Page Load Time: ~6.5s
```

### Post-Deployment Targets

```yaml
Target Period: 24-48 hours after deployment
Success Criteria:
  - LCP p75: 4700-5000ms (200-500ms improvement)
  - Good LCP Rate: >50%
  - No increase in error rates
  - No auth flow regressions
```

### Custom Dashboard for PR #1282

Create a dedicated dashboard to track the lazy loading impact:

**Dashboard Name:** "PR #1282 - Supabase Lazy Loading Impact"

**Panels:**

1. **LCP Before/After Comparison:**
   ```
   Time range: Dec 1-8 (baseline) vs. Dec 9+ (post-deploy)
   Metric: p75(LCP)
   Visualization: Comparison chart
   ```

2. **Bundle Size Impact:**
   ```
   Event: page_load
   Property: bundle_size_kb
   Aggregate: Average
   Filter: url contains main bundle
   Time range: Last 7 days
   ```

3. **Auth Flow Performance:**
   ```
   Event: user_authenticated
   Metric: Duration (ms)
   Percentiles: p50, p75, p95
   Time range: Last 7 days
   ```

4. **Error Rate Monitoring:**
   ```
   Event: $exception
   Filter: message contains "Supabase" OR "lazy"
   Aggregate: Count
   Group by: Hour
   Time range: Last 24 hours
   ```

---

## PostHog Insights Setup

### Creating Insights

1. **Insight: LCP by Browser**
   ```
   Event: web_vitals
   Filter: name = LCP
   Metric: p75(value)
   Breakdown: $browser
   Visualization: Bar chart
   ```

2. **Insight: LCP by Connection Type**
   ```
   Event: web_vitals
   Filter: name = LCP
   Metric: p75(value)
   Breakdown: connection (4g/3g/slow-2g)
   Visualization: Bar chart
   ```

3. **Insight: LCP by Device Type**
   ```
   Event: web_vitals
   Filter: name = LCP
   Metric: p75(value)
   Breakdown: $device_type (Mobile/Desktop/Tablet)
   Visualization: Bar chart
   ```

4. **Insight: LCP by Page**
   ```
   Event: web_vitals
   Filter: name = LCP
   Metric: p75(value)
   Breakdown: $pathname
   Sort by: p75(value) DESC
   Limit: 20
   ```

---

## Integration with Existing Monitoring

### Sentry Integration

Link PostHog alerts with Sentry for error correlation:

1. **Connect PostHog to Sentry:**
   - PostHog Settings → Integrations → Sentry
   - Add Sentry DSN

2. **Create Correlated Alert:**
   ```yaml
   Name: "LCP Degradation + Errors"
   
   Trigger:
     - LCP p75 > 2500ms
     AND
     - Sentry error rate > 5 errors/min
   
   Notification:
     "🔴 Critical: LCP degradation with errors
      LCP: {lcp_value}ms
      Errors: {error_count}
      Sentry: {sentry_link}
      PostHog: {posthog_link}"
   ```

### Slack Bot Commands

Configure Slack bot for on-demand metrics:

```bash
# Get current LCP
/posthog lcp

# Get last hour summary
/posthog vitals last-hour

# Compare to yesterday
/posthog lcp compare yesterday
```

---

## Troubleshooting

### Metrics Not Appearing

**Check 1: PostHog Key**
```bash
# Verify environment variable
netlify env:get VITE_POSTHOG_KEY
```

**Check 2: CSP Headers**
```bash
# Verify PostHog domains in CSP
curl -I https://contributor.info | grep -i content-security-policy
```

**Check 3: Browser Console**
```javascript
// Check PostHog loaded
console.log(window.posthog);

// Check Web Vitals
localStorage.setItem('WEB_VITALS_DEBUG', 'true');
location.reload();
```

### Alert Not Triggering

**Verification Steps:**

1. **Check Event Volume:**
   ```
   Go to PostHog → Events
   Search: web_vitals WHERE name = LCP
   Time range: Last 1 hour
   Expected: >50 events/hour
   ```

2. **Test Alert Manually:**
   ```
   PostHog → Alerts → [Your Alert]
   Click "Test Now"
   Check Slack/Email
   ```

3. **Review Alert History:**
   ```
   PostHog → Alerts → [Your Alert] → History
   Check: Last triggered, False positives
   ```

---

## Maintenance

### Weekly Tasks

- [ ] Review LCP dashboard for trends
- [ ] Check alert accuracy (false positives)
- [ ] Verify data completeness (no gaps)
- [ ] Update baseline metrics if needed

### Monthly Tasks

- [ ] Audit alert thresholds
- [ ] Review slowest pages (top 20)
- [ ] Analyze LCP by browser/device
- [ ] Generate performance report

### After Deployments

- [ ] Monitor LCP for 2 hours post-deploy
- [ ] Compare to pre-deploy baseline
- [ ] Check for alert triggers
- [ ] Update documentation if behavior changed

---

## Success Metrics

### Short-term (First Week)

- ✅ LCP p75 < 5000ms (baseline: 5200ms)
- ✅ Good LCP rate > 50% (baseline: 45%)
- ✅ Zero alert false positives
- ✅ 100% data collection uptime

### Long-term (First Month)

- 🎯 LCP p75 < 2500ms (Google "Good" threshold)
- 🎯 Good LCP rate > 75%
- 🎯 Zero LCP regressions from deployments
- 🎯 Complete browser/device coverage

---

## Resources

### PostHog Documentation

- [Web Analytics Guide](https://posthog.com/docs/web-analytics)
- [Alerts Documentation](https://posthog.com/docs/user-guides/alerts)
- [Dashboard Best Practices](https://posthog.com/docs/user-guides/dashboards)

### Internal Documentation

- [Web Vitals Integration](./posthog-web-vitals.md)
- [PR #1282 Audit](../implementations/pr-1282-supabase-lazy-loading-audit.md)
- [Performance Best Practices](./performance-best-practices.md)

### External Resources

- [Web Vitals Documentation](https://web.dev/vitals/)
- [LCP Optimization Guide](https://web.dev/optimize-lcp/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

---

## Support

### Questions or Issues?

- **Slack:** #performance-monitoring
- **Email:** engineering@contributor.info
- **PostHog Support:** support@posthog.com

### Escalation Path

1. Check dashboard for anomalies
2. Review Sentry for correlated errors
3. Analyze recent deployments
4. Contact DevOps if infrastructure issue

---

**Last Updated:** 2025-12-09  
**Owner:** Performance Team  
**Reviewers:** @bdougieyo, @engineering-team
