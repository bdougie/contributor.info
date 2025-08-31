# Feature Flags Implementation Guide

## Overview

This project implements a comprehensive feature flag system integrated with PostHog for controlled feature rollouts, A/B testing, and experimentation. The system follows privacy-first principles and provides automatic rollback capabilities on error spikes.

## Architecture

### Components

1. **PostHog Client** (`src/lib/feature-flags/posthog-client.ts`)
   - Handles feature flag evaluation
   - Manages caching and performance
   - Integrates with PostHog SDK

2. **React Context** (`src/lib/feature-flags/context.tsx`)
   - Provides feature flags to React components
   - Manages user context
   - Handles flag reloading

3. **Components** (`src/lib/feature-flags/components.tsx`)
   - `<FeatureFlag>` - Conditional rendering based on flags
   - `<Experiment>` - A/B testing component
   - `<FeatureGate>` - Multiple flag requirements
   - `<RolloutPercentage>` - Manual percentage rollouts

4. **Monitoring** (`src/lib/feature-flags/monitoring.tsx`)
   - Error spike detection
   - Automatic rollback on failures
   - Performance monitoring

## Quick Start

### Basic Usage

```tsx
import { FeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';

function MyComponent() {
  return (
    <FeatureFlag flag={FEATURE_FLAGS.ENABLE_NEW_SEARCH}>
      <NewSearchComponent />
    </FeatureFlag>
  );
}
```

### Using Hooks

```tsx
import { useFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';

function MyComponent() {
  const isNewSearchEnabled = useFeatureFlag(FEATURE_FLAGS.ENABLE_NEW_SEARCH);
  
  if (isNewSearchEnabled) {
    return <NewSearchComponent />;
  }
  
  return <OldSearchComponent />;
}
```

### A/B Testing

```tsx
import { Experiment } from '@/lib/feature-flags';

function HomePage() {
  return (
    <Experiment
      name="homepage_redesign"
      control={<CurrentHomepage />}
      variants={{
        variant_a: <NewHomepage />,
        variant_b: <AlternativeHomepage />
      }}
    />
  );
}
```

## Available Feature Flags

### Infrastructure Flags

- `enable_new_search` - Test improved search algorithm
- `enable_workspace_analytics` - Roll out analytics dashboard (10% rollout)
- `enable_performance_optimizations` - Test performance improvements (50% rollout)

### UI/UX Experiments

- `new_onboarding_flow` - Test simplified onboarding
- `repository_card_redesign` - A/B test new card design
- `dark_mode_default` - Test default theme preference

### Feature Gates

- `enable_bulk_operations` - Gate bulk repository management
- `enable_advanced_filters` - Progressive rollout of filtering (25% rollout)
- `enable_export_features` - Control data export capabilities

## Best Practices

### 1. Naming Conventions

Use descriptive, action-oriented names:
- ✅ `enable_workspace_analytics`
- ✅ `experiment_new_homepage`
- ❌ `test123`
- ❌ `flag1`

### 2. Default Behavior

All flags should default to `false` (current behavior):

```typescript
{
  name: FEATURE_FLAGS.ENABLE_NEW_FEATURE,
  defaultValue: false, // Always false
  description: 'Clear description of what this enables',
}
```

### 3. Gradual Rollout

Start with small percentages and increase gradually:

```typescript
// Week 1: 5% rollout
rolloutPercentage: 5,

// Week 2: 25% rollout (if no issues)
rolloutPercentage: 25,

// Week 3: 50% rollout
rolloutPercentage: 50,

// Week 4: 100% rollout
rolloutPercentage: 100,
```

### 4. Error Handling

Always provide fallbacks:

```tsx
<FeatureFlag 
  flag={FEATURE_FLAGS.ENABLE_NEW_FEATURE}
  fallback={<OldFeature />}
>
  <NewFeature />
</FeatureFlag>
```

### 5. Performance Monitoring

Track performance impact:

```tsx
import { performanceMonitor } from '@/lib/feature-flags';

function NewFeature() {
  const startTime = performance.now();
  
  // Feature logic...
  
  performanceMonitor.recordMetric(
    FEATURE_FLAGS.ENABLE_NEW_FEATURE,
    performance.now() - startTime
  );
}
```

## Monitoring & Rollback

### Automatic Rollback

The system automatically rolls back features on error spikes:

```tsx
<FeatureFlagMonitor
  errorThreshold={10}        // Rollback after 10 errors
  windowMs={60000}           // Within 1 minute
  rollbackFlags={[
    FEATURE_FLAGS.ENABLE_NEW_SEARCH,
    FEATURE_FLAGS.ENABLE_WORKSPACE_ANALYTICS
  ]}
  onRollback={(flag) => {
    console.error(`Feature ${flag} rolled back due to errors`);
  }}
>
  <App />
</FeatureFlagMonitor>
```

### Manual Rollback

In PostHog dashboard:
1. Navigate to Feature Flags
2. Find the problematic flag
3. Set rollout percentage to 0
4. Or disable the flag entirely

## Testing

### Local Testing with URL Parameters

Add `?ff_<flag_name>=true` to test flags locally:

```
http://localhost:5173?ff_enable_new_search=true
```

### Programmatic Testing

```typescript
import { createFeatureFlagOverride } from '@/lib/feature-flags';

// In development only
createFeatureFlagOverride({
  enable_new_search: true,
  enable_workspace_analytics: false,
});
```

### Unit Testing

```typescript
import { render } from '@testing-library/react';
import { FeatureFlagsProvider } from '@/lib/feature-flags';

test('renders with feature flag', () => {
  render(
    <FeatureFlagsProvider 
      userId="test-user"
      organizationId="test-org"
    >
      <MyComponent />
    </FeatureFlagsProvider>
  );
});
```

## Debugging

### Enable Debug Mode

In development, add the `<FeatureFlagDebug>` component:

```tsx
import { FeatureFlagDebug } from '@/lib/feature-flags';

function App() {
  return (
    <>
      {process.env.NODE_ENV === 'development' && (
        <FeatureFlagDebug className="fixed bottom-4 left-4" />
      )}
      {/* Your app */}
    </>
  );
}
```

### Check Flag Status

```typescript
import { getAllFeatureFlags } from '@/lib/feature-flags';

// Log all flag statuses
const flags = await getAllFeatureFlags();
console.table(Array.from(flags.entries()));
```

## Privacy & Compliance

1. **Anonymous by Default**: Users are not identified until login
2. **No PII in Flags**: Never include personal information in flag names or values
3. **Opt-out Support**: Users can opt out of feature flags via settings
4. **Audit Logging**: All flag changes are logged in PostHog

## Performance Considerations

1. **Caching**: Flag evaluations are cached for 5 minutes
2. **Lazy Loading**: PostHog SDK is loaded on-demand
3. **Rate Limiting**: Built-in rate limiting prevents excessive API calls
4. **Bundle Size**: Feature flag code adds ~15KB to bundle (before gzip)

## Migration Guide

### Adding a New Flag

1. Add to `FEATURE_FLAGS` constant:
```typescript
// src/lib/feature-flags/types.ts
export const FEATURE_FLAGS = {
  // ...existing flags
  MY_NEW_FEATURE: 'my_new_feature',
} as const;
```

2. Add configuration:
```typescript
// src/lib/feature-flags/posthog-client.ts
[FEATURE_FLAGS.MY_NEW_FEATURE]: {
  name: FEATURE_FLAGS.MY_NEW_FEATURE,
  defaultValue: false,
  description: 'Description of what this enables',
  rolloutPercentage: 0,
},
```

3. Use in component:
```tsx
<FeatureFlag flag={FEATURE_FLAGS.MY_NEW_FEATURE}>
  <NewFeature />
</FeatureFlag>
```

### Removing a Flag

1. Ensure 100% rollout for 2 weeks
2. Remove conditional rendering in components
3. Remove from `FEATURE_FLAGS` and configurations
4. Deploy and monitor for issues

## Troubleshooting

### Flag Not Working

1. Check PostHog is initialized: `isPostHogEnabled()`
2. Verify flag name matches exactly
3. Check user/org overrides
4. Review rollout percentage
5. Clear cache: `featureFlagClient.reloadFlags()`

### Performance Issues

1. Check cache hit rate
2. Review rate limiting stats: `getRateLimiterStats()`
3. Reduce number of flag evaluations
4. Use batch checking for multiple flags

### Rollback Not Triggering

1. Verify error threshold settings
2. Check monitoring is enabled
3. Review error types being caught
4. Ensure flags are in rollback list

## Support

For issues or questions:
1. Check this documentation
2. Review existing GitHub issues
3. Create new issue with `feature-flag` label
4. Include flag name, expected behavior, and actual behavior