# PostHog Analytics Strategy

This document outlines the privacy-first analytics approach implemented for contributor.info using PostHog.

## Core Philosophy

We follow a **privacy-first, cost-effective** analytics strategy that:
- Uses anonymous events by default (4x cheaper than identified events)
- Only identifies users after login/signup
- Filters internal users from analytics data
- Focuses on high-value events rather than excessive tracking

## Implementation Phases

### Phase 1: Foundation (✅ Implemented)
- **Autocapture enabled**: Baseline tracking for pageviews, clicks, form submissions
- **Internal user filtering**: @bdougie account filtered from all analytics
- **Privacy-first configuration**: `person_profiles: 'identified_only'`
- **Anonymous events**: Cost-effective browsing behavior tracking

### Phase 2: Key Actions (Planned)
- **Track repository button events**: Our main conversion metric
- **Repository engagement tracking**: Time spent on repository pages
- **Custom events for high-value actions**

### Phase 3: Authentication Flow (Planned)
- **Auth form visibility tracking**: Understand signup funnel without tracking clicks
- **Login/signup completion tracking**: Backend accuracy for auth completions

### Phase 4: Optimization (Planned)
- **Data review and cleanup**: Kill low-value events based on insights
- **Performance impact monitoring**: Measure analytics overhead
- **A/B testing setup**: For key user flows

## Privacy & Compliance

### User Consent
- **Anonymous browsing**: No consent required for basic pageview/click tracking
- **Identified events**: Only after explicit user login/signup
- **Opt-out mechanism**: Users can disable tracking via `localStorage`

### Data Filtering
```typescript
// Internal users filtered from analytics
const internalUsers = ['bdougie'];
const isInternal = user.login === 'bdougie' || 
                   window.location.hostname === 'localhost';
```

### GDPR Compliance
- Anonymous events don't require consent under GDPR
- User identification only after login (implicit consent)
- Clear opt-out mechanisms available
- No personal data collected without user action

## Technical Configuration

### PostHog Config
```typescript
const POSTHOG_CONFIG = {
  person_profiles: 'identified_only', // 4x cheaper anonymous events
  autocapture: true, // Baseline tracking in production
  capture_pageview: true,
  capture_pageleave: true,
  disable_session_recording: true, // Performance optimization
  disable_surveys: true,
  advanced_disable_decide: true, // No feature flags
};
```

### Event Categories

#### Automatic Events (Autocapture)
- Page views and navigation
- Button clicks and form interactions
- Link clicks and downloads
- **Cost**: Anonymous events (1x cost unit)

#### Custom Events (Strategic)
```typescript
// Repository engagement
trackEvent('track_repo_button_viewed', { 
  repo_name: repoName, 
  user_logged_in: isLoggedIn 
});

// Authentication funnel
trackEvent('auth_form_viewed', { 
  form_type: 'login', 
  source: 'header' 
});

// Page engagement
trackEvent('page_viewed', { 
  page: 'repository_detail', 
  duration: timeSpent 
});
```

#### Identified Events (Post-Login)
- User profile creation
- Repository tracking actions
- Subscription upgrades
- **Cost**: Identified events (4x cost unit)

## Performance Considerations

### Bundle Size
- **Lazy loading**: PostHog only loads when needed
- **Dynamic imports**: Reduces initial bundle impact
- **Tree shaking**: Only import used functionality

### Rate Limiting
```typescript
const rateLimiter = {
  maxEventsPerMinute: 60,
  maxEventsPerHour: 1000,
};
```

### Error Handling
- Silent failures in production
- Detailed logging in development
- Graceful degradation when PostHog unavailable

## Data Collection Standards

### What We Track
✅ **Page navigation patterns** (anonymous autocapture)
✅ **Button interactions** (anonymous autocapture)  
✅ **Form submissions** (anonymous autocapture)
✅ **Repository tracking actions** (custom events)
✅ **Authentication flow visibility** (custom events)

### What We Don't Track
❌ **Session recordings** (disabled for performance)
❌ **Personal information** (only after login)
❌ **Internal user activity** (filtered out)
❌ **Development environment** (disabled by default)

## Monitoring & Alerts

### Key Metrics
- Event volume per day/hour
- Error rates in event sending
- Performance impact measurements
- User opt-out rates

### Performance Thresholds
- Bundle size impact: < 50KB additional
- Event sending latency: < 100ms
- Rate limit violations: < 1% of events

### Alert Conditions
- PostHog initialization failures
- Rate limiting triggered frequently  
- Bundle size increases significantly
- Event sending error rate > 5%

## Cost Management

### Event Pricing Strategy
- **Anonymous events**: 1x cost (browsing behavior)
- **Identified events**: 4x cost (post-login actions)
- **Monthly budget**: Focus on high-value identified events

### Volume Estimates
- **Anonymous events**: ~10,000/month (pageviews, clicks)
- **Identified events**: ~500/month (tracked repos, signups)
- **Total cost**: Optimized for insight-to-cost ratio

## Usage Examples

### Basic Setup
```typescript
// Initialize with privacy-first config
import { trackEvent, identifyUser } from './posthog-lazy';

// Track anonymous browsing (automatic via autocapture)
// No additional code needed

// Track high-value action
await trackEvent('track_repo_clicked', {
  repo_name: 'facebook/react',
  user_logged_in: false
});

// Identify after login
await identifyUser(userId, {
  plan: 'free',
  signup_date: new Date()
});
```

### Custom Event Patterns
```typescript
// Repository engagement
trackEvent('repo_page_viewed', {
  repo: repoName,
  duration: timeSpent,
  scroll_depth: scrollPercent
});

// Authentication funnel
trackEvent('auth_form_viewed', {
  form_type: 'signup',
  source: 'repository_page',
  repo_context: repoName
});

// Conversion events
trackEvent('repo_tracked', {
  repo: repoName,
  method: 'button_click',
  user_type: 'anonymous'
});
```

## Implementation Checklist

- [x] Privacy-first PostHog configuration
- [x] Internal user filtering (@bdougie)
- [x] Anonymous event setup with autocapture
- [x] Rate limiting and error handling
- [x] Performance optimizations (lazy loading)
- [ ] Custom event tracking for key actions
- [ ] User identification flow (post-login)
- [ ] Performance monitoring dashboard
- [ ] A/B testing framework (if needed)

## Next Steps

1. **Monitor baseline data** from autocapture for 1-2 weeks
2. **Implement Phase 2** custom events for repository tracking
3. **Add authentication flow tracking** in Phase 3
4. **Optimize based on data insights** in Phase 4

This strategy ensures we collect valuable user behavior insights while respecting privacy, minimizing performance impact, and controlling costs.